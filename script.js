const GITHUB_API_URL = "https://api.github.com";
const BATCH_SIZE = 50;
const DELAY_BETWEEN_REQUESTS = 2000;

document.getElementById("fetch-button").addEventListener("click", async () => {
  await fetchStargazers(false);  
});

document.getElementById("fetch-last-24h").addEventListener("click", async () => {
  await fetchStargazers(true);
});

async function fetchStargazers(last24Hours = false) {
  const repoUrl = document.getElementById("repo-url").value;
  const githubToken = document.getElementById("github-token").value;
  const repoPath = extractRepoPath(repoUrl);

  if (!repoPath || !githubToken) {
    alert("Invalid GitHub repository URL or token");
    return;
  }

  document.getElementById("loading").style.display = "block";
  document.getElementById("fetch-button").disabled = true;
  document.getElementById("fetch-last-24h").disabled = true;
  document.getElementById("download-link").style.display = "none";
  document.getElementById("export-excel").style.display = "none";

  try {
    let stargazers = await fetchAllStargazers(repoPath, githubToken);

    if (last24Hours) {
      const last24hTimestamp = new Date();
      last24hTimestamp.setDate(last24hTimestamp.getDate() - 1);
      
      stargazers = stargazers.filter(star => new Date(star.starred_at) >= last24hTimestamp);
    }

    const enrichedStargazers = await enrichStargazersInBatches(stargazers, githubToken);
    const csvData = generateCSV(enrichedStargazers);
    downloadCSV(csvData, last24Hours ? "stargazers_last_24h.csv" : "stargazers.csv");

    document.getElementById("download-link").style.display = "block";
    document.getElementById("export-excel").style.display = "block";

    document.getElementById("export-excel").addEventListener("click", () => exportToExcel(enrichedStargazers));
  } catch (error) {
    console.error("Error fetching stargazers:", error);
    alert("Failed to fetch stargazers. Check the console for details.");
  } finally {
    document.getElementById("loading").style.display = "none";
    document.getElementById("fetch-button").disabled = false;
    document.getElementById("fetch-last-24h").disabled = false;
  }
}

function extractRepoPath(url) {
  const match = url.match(/github\.com\/([^\/]+\/[^\/]+)/);
  return match ? match[1] : null;
}

async function fetchAllStargazers(repoPath, githubToken) {
  let stargazers = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(`${GITHUB_API_URL}/repos/${repoPath}/stargazers?page=${page}&per_page=100`, {
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: "application/vnd.github.v3.star+json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch stargazers: ${response.statusText}`);
    }

    const data = await response.json();
    stargazers = stargazers.concat(data);
    hasMore = data.length === 100;
    page++;
  }

  return stargazers;
}

async function enrichStargazersInBatches(stargazers, githubToken) {
  const enrichedStargazers = [];

  for (let i = 0; i < stargazers.length; i += BATCH_SIZE) {
    const batch = stargazers.slice(i, i + BATCH_SIZE);
    const enrichedBatch = await Promise.all(
      batch.map(async (stargazer) => {
        const userDetails = await fetchUserDetailsWithRetry(stargazer.user.login, githubToken);
        return {
          username: stargazer.user.login,
          email: userDetails.email || "N/A",
          linkedin: userDetails.blog && userDetails.blog.includes("linkedin.com") ? userDetails.blog : "N/A",
          twitter: userDetails.twitter_username ? `https://twitter.com/${userDetails.twitter_username}` : "N/A",
          profile_url: stargazer.user.html_url,
        };
      })
    );

    enrichedStargazers.push(...enrichedBatch);
    await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
  }

  return enrichedStargazers;
}

async function fetchUserDetailsWithRetry(username, githubToken, retries = 3) {
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
        throw new Error(`Failed to fetch user details for ${username}: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error(`Attempt ${attempt} failed for ${username}:`, error);
      if (attempt === retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
    }
  }
}

function generateCSV(stargazers) {
  const headers = ["Username", "Email", "LinkedIn", "Twitter", "Profile URL"];
  const rows = stargazers.map(stargazer => [
    stargazer.username,
    stargazer.email,
    stargazer.linkedin,
    stargazer.twitter,
    stargazer.profile_url,
  ]);

  const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
  return csvContent;
}

function downloadCSV(data, filename) {
  const blob = new Blob([data], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.getElementById("download-link");
  link.href = url;
  link.download = filename;
}

function exportToExcel(stargazers) {
  const ws = XLSX.utils.json_to_sheet(stargazers);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Stargazers");
  XLSX.writeFile(wb, "stargazers.xlsx");
}
