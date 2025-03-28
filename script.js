const BATCH_SIZE = 50;
const REQUEST_DELAY = 2000;
const GITHUB_API_URL = "https://api.github.com";
let enrichedStargazers = [];

class StargazerFetcher {
  constructor(tokens) {
    this.authTokens = tokens;
    this.stargazersData = [];
    this.workers = [];
    this.isFetching = false;
    this.totalPages = 0;
    this.completedPages = 0;
    this.pageQueue = [];
    this.activeWorkers = 0;
    this.BASE_DELAY = 500;
    this.MAX_RETRIES = 3;
    this.concurrency = tokens.length;
    this.rateLimits = {};
    this.backoffFactor = 1;
    this.minDelay = 500;
    this.maxDelay = 32000;
    this.redisEnabled = true;
    this.currentRepoKey = null;
  }

  async fetchAllStargazers(owner, repo) {
    this.isFetching = true;
    this.updateStatus("Initializing...");
    this.resetState();
    this.currentOwner = owner;
    this.currentRepo = repo;
    this.currentRepoKey = `stargazers:${owner}:${repo}`;

    try {
      await fetch(`http://localhost:3001/api/clear?owner=${owner}&repo=${repo}`);
    } catch (error) {
      console.error("Redis clear error:", error);
    }

    try {
      const totalCount = await this.getTotalCount(owner, repo);
      this.totalPages = Math.ceil(totalCount / 100);
      this.initializeQueue();

      this.workers = this.authTokens.map((token) =>
        this.createWorker(token, owner, repo).then(async () => {
          const response = await fetch(
            `http://localhost:3001/api/stargazers?owner=${this.currentOwner}&repo=${this.currentRepo}`
          );
          const stargazers = await response.json();
          await this.enrichStargazersInBatches(stargazers, token);
        })
      );

      await Promise.all(this.workers);
      return this.stargazersData;
    } finally {
      this.isFetching = false;
    }
  }

  resetState() {
    this.stargazersData = [];
    this.pageQueue = [];
    this.completedPages = 0;
    this.activeWorkers = 0;
    document.querySelector(".progress-bar").style.width = "0%";
  }

  async getTotalCount(owner, repo) {
    const query = `{
      repository(owner: "${owner}", name: "${repo}") {
        stargazers(first: 1) {
          totalCount
        }
      }
    }`;
    const response = await this.graphqlRequest(this.authTokens[0], query);
    return response.data.repository.stargazers.totalCount;
  }

  initializeQueue() {
    this.pageQueue = Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  createWorker(token, owner, repo) {
    return new Promise(async (resolve) => {
      let retryCount = 0;
      while (this.pageQueue.length > 0 || this.activeWorkers > 0) {
        if (!this.acquirePage()) {
          await this.waitForWork();
          continue;
        }

        const currentPage = this.pageQueue.shift();
        this.activeWorkers++;

        try {
          const { response, ghRemaining } = await this.fetchPage(
            token,
            owner,
            repo,
            currentPage
          );
          await this.processPage(response, currentPage, ghRemaining);
          retryCount = 0;
        } catch (error) {
          await this.handleError(token, error, currentPage, retryCount);
          retryCount++;
        } finally {
          this.activeWorkers--;
        }
        await this.delay();
      }
      resolve();
    });
  }

  acquirePage() {
    return this.pageQueue.length > 0 && this.activeWorkers < this.concurrency;
  }

  async fetchPage(token, owner, repo, page) {
    const url = `https://api.github.com/repos/${owner}/${repo}/stargazers?per_page=100&page=${page}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `bearer ${token}`,
        Accept: "application/vnd.github.v3.star+json",
      },
    });

    const ghRemaining = parseInt(
      response.headers.get("X-RateLimit-Remaining") || "9999",
      10
    );

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || `HTTP error: ${response.status}`);
    }

    const data = await response.json();
    return { response: data, ghRemaining };
  }

  async processPage(response, page, ghRemaining) {
    if (!Array.isArray(response)) {
      console.error("Response is not an array", response);
      return;
    }

    const stargazers = response.map((star) => ({
      login: star.user?.login,
      avatarUrl: star.user?.avatar_url,
      profileUrl: star.user?.html_url,
      starredAt: star.starred_at,
    }));

    if (this.redisEnabled) {
      await this.storeInRedis(stargazers);
    } else {
      console.log("Redis not enabled")
      this.stargazersData.push(...stargazers);
    }

    this.completedPages++;
    this.updateProgress();

    if (ghRemaining <= 0) {
      console.warn("Rate limit exceeded. Consider waiting before further requests.");
    }
  }

  async enrichStargazersInBatches(stargazers, githubToken) {
    for (let i = 0; i < stargazers.length; i += BATCH_SIZE) {
      const batch = stargazers.slice(i, i + BATCH_SIZE);
      const enrichedBatch = await Promise.all(
        batch.map(async (stargazer) => {
          const userDetails = await this.fetchUserDetailsWithRetry(
            stargazer.login,
            githubToken
          );
          return {
            username: stargazer.login,
            profile_url: stargazer.profileUrl,
            email: userDetails.email || "N/A",
            company: userDetails.company || "N/A",
            location: userDetails.location || "N/A",
            website: userDetails.blog || "N/A",
            linkedin: this.extractLinkedIn(userDetails),
            twitter: userDetails.twitter_username
              ? `https://twitter.com/${userDetails.twitter_username}`
              : "N/A",
            bio: userDetails.bio || "N/A",
          };
        })
      );
      enrichedStargazers.push(...enrichedBatch);
      await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY));
    }
    return enrichedStargazers;
  }

  async generateCSV(stargazers) {
    if (!Array.isArray(stargazers) || stargazers.length === 0) {
      console.warn("No valid stargazers found for CSV export.");
      return "";
    }

    const headers = [
      "Username",
      "GitHub URL",
      "Email",
      "Company",
      "Location",
      "Website",
      "LinkedIn",
      "Twitter",
      "Bio",
    ];

    const rows = stargazers.map((stargazer) => {
      return [
        stargazer.username || stargazer.login || "N/A",
        stargazer.profile_url || `https://github.com/${stargazer.login || "N/A"}`,
        stargazer.email || "N/A",
        stargazer.company || "N/A",
        stargazer.location || "N/A",
        stargazer.website || "N/A",
        stargazer.linkedin || "N/A",
        stargazer.twitter || "N/A",
        stargazer.bio ? `"${stargazer.bio.replace(/"/g, '""')}"` : "N/A",
      ];
    });

    return [headers, ...rows].map((row) => row.join(",")).join("\n");
  }

  async graphqlRequest(token, query) {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });
    const data = await response.json();
    if (data.errors) {
      throw new Error(data.errors[0].message);
    }
    return data;
  }

  async fetchUserDetailsWithRetry(username, githubToken, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(`${GITHUB_API_URL}/users/${username}`, {
          headers: { Authorization: `token ${githubToken}` },
        });

        if (!response.ok) {
          if (response.status === 403) {
            await new Promise((resolve) => setTimeout(resolve, 60000));
            continue;
          }
          throw new Error(
            `Failed to fetch user details for ${username}: ${response.statusText}`
          );
        }
        return await response.json();
      } catch (error) {
        console.error(`Attempt ${attempt} failed for ${username}:`, error);
        if (attempt === retries) throw error;
        await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY));
      }
    }
  }

  extractLinkedIn(userDetails) {
    if (userDetails.blog && userDetails.blog.includes("linkedin.com")) {
      return userDetails.blog;
    }
    return "N/A";
  }

  updateProgress() {
    const progress = Math.min(this.completedPages / this.totalPages, 1);
    const percentage = Math.round(progress * 100);
    document.querySelector(".progress-bar").style.width = `${percentage}%`;
    // document.getElementById("status").textContent = 
    //   `Fetched ${this.stargazersData.length} stargazers (${percentage}%)`;
  }

  async handleError(token, error, page, retryCount) {
    if (retryCount >= this.MAX_RETRIES) {
      this.updateStatus(`Page ${page} failed after ${this.MAX_RETRIES} retries`);
      return;
    }

    if (error.message.includes("rate limit")) {
      const resetTime = this.parseRateLimit(error.message);
      this.rateLimits[token] = { reset: resetTime };
      this.pageQueue.unshift(page);
      this.updateStatus(`Rate limited. Retrying page ${page}...`);
    } else {
      this.pageQueue.unshift(page);
      this.updateStatus(`Error on page ${page}: ${error.message}`);
    }
  }

  parseRateLimit(errorMessage) {
    const resetMatch = errorMessage.match(/reset at (\d+)/);
    return resetMatch ? parseInt(resetMatch[1]) * 1000 : Date.now() + 60000;
  }

  async waitForWork() {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  async delay() {
    const delayMs = this.minDelay * this.backoffFactor;
    const clampedDelay = Math.min(delayMs, this.maxDelay);
    await new Promise((resolve) => setTimeout(resolve, clampedDelay));
  }

  updateStatus(message) {
    document.getElementById("status").textContent = message;
  }

  async storeInRedis(stargazers) {
    try {
      const response = await fetch("http://localhost:3001/api/stargazers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: this.currentOwner,
          repo: this.currentRepo,
          stargazers,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Redis storage failed: ${errorText}`);
      }
    } catch (error) {
      console.error("Redis storage error:", error);
      this.redisEnabled = false;
      this.stargazersData.push(...stargazers);
    }
  }

  async exportToCSV(owner, repo) {
    try {
      const realOwner = repo[0];
      const realRepo = repo[1];
      const response = await fetch(
        `http://localhost:3001/api/stargazers?owner=${realOwner}&repo=${realRepo}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch stargazers: ${response.statusText}`);
      }
      const stargazers = await response.json();
      if (!stargazers || !Array.isArray(stargazers) || stargazers.length === 0) {
        console.warn("No valid stargazers found for CSV export.");
        return [];
      }
      const uniqueStargazers = [
        ...new Map(stargazers.map((s) => [s.login, s])).values(),
      ];
      return uniqueStargazers;
    } catch (error) {
      console.error("Error exporting from Redis:", error);
      return [];
    }
  }

  downloadCSV(csvContent) {
    const blob = new Blob([csvContent], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "stargazers.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

async function getRateLimit(tokens) {
  let rateLimits = {};
  const rateLimitPromises = tokens.map(async (token) => {
    try {
      const response = await fetch("https://api.github.com/rate_limit", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch rate limit: ${response.statusText}`);
      }
      const data = await response.json();
      rateLimits[token] = data.rate.remaining;
    } catch (error) {
      console.error(`Error fetching rate limit for token: ${token}`, error);
      rateLimits[token] = null;
    }
  });
  await Promise.allSettled(rateLimitPromises);
  const validLimits = Object.entries(rateLimits).filter(
    ([, limit]) => typeof limit === "number" && !isNaN(limit)
  );
  if (validLimits.length === 0) {
    return { rateLimits, selectedToken: null, minRateLimit: -1 };
  }
  const minRateLimit = Math.min(...validLimits.map(([, limit]) => limit));
  const minTokens = validLimits
    .filter(([, limit]) => limit === minRateLimit)
    .map(([token]) => token);
  const selectedToken = minTokens[Math.floor(Math.random() * minTokens.length)];
  return { rateLimits, selectedToken, minRateLimit };
}

document.addEventListener("DOMContentLoaded", () => {
  const fetchButton = document.getElementById("fetchButton");
  const exportButton = document.getElementById("exportButton");
  const addTokenButton = document.getElementById("addTokenButton");
  const tokenList = document.getElementById("tokenList");

  let tokens = [];

  function getTokens() {
    tokens = [];
    document.querySelectorAll(".tokenField").forEach((input) => {
      const token = input.value.trim();
      if (token) tokens.push(token);
    });
    return tokens;
  }

  function addTokenInput() {
    const tokenDiv = document.createElement("div");
    tokenDiv.classList.add("input-group");

    const tokenInput = document.createElement("input");
    tokenInput.type = "text";
    tokenInput.classList.add("tokenField");
    tokenInput.placeholder = "Enter GitHub Token";

    const removeButton = document.createElement("button");
    removeButton.textContent = "Remove";
    removeButton.classList.add("remove-token");
    removeButton.addEventListener("click", () => {
      tokenDiv.remove();
    });

    tokenDiv.appendChild(tokenInput);
    tokenDiv.appendChild(removeButton);
    tokenList.appendChild(tokenDiv);
  }

  addTokenButton.addEventListener("click", addTokenInput);

  function initializeFetcher() {
    const userTokens = getTokens();
    if (userTokens.length === 0) {
      alert("Please enter at least one GitHub token.");
      return null;
    }
    return new StargazerFetcher(userTokens);
  }

  fetchButton.addEventListener("click", async () => {
    fetchButton.disabled = true;
    exportButton.disabled = true;
    const fetcher = initializeFetcher();
    if (!fetcher) return;

    const owner = document.getElementById("ownerInput").value.trim();
    const repo = document.getElementById("repoInput").value.trim();

    try {
      await fetcher.fetchAllStargazers(owner, repo);
      (async () => {
        await getRateLimit(tokens);
      })();
      exportButton.disabled = false;
      fetcher.updateStatus("Completed successfully!");
    } catch (error) {
      console.error("Fetching Error:", error);
      fetcher.updateStatus(`Error: ${error.message}`);
    } finally {
      fetchButton.disabled = false;
    }
  });


  exportButton.addEventListener("click", async () => {
    try {
      const fetcher = initializeFetcher();
      if (!fetcher) return;

      const enrichedData = enrichedStargazers;
      if (!enrichedData || enrichedData.length === 0) {
        alert("No data available to export. Please check if the repository has stargazers.");
        return;
      }
      const csvContent = await fetcher.generateCSV(enrichedData);
      if (!csvContent) {
        alert("CSV generation failed.");
        return;
      }
      fetcher.downloadCSV(csvContent);
    } catch (error) {
      console.error("Error exporting CSV:", error);
    }
  });
});
