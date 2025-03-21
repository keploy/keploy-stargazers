import * as XLSX from 'xlsx';

const GITHUB_API_URL = "https://api.github.com";
const BATCH_SIZE = 50;
const DELAY_BETWEEN_REQUESTS = 2000;

export const extractRepoPath = (url) => {
  const match = url.match(/github\.com\/([^\/]+\/[^\/]+)/);
  return match ? match[1] : null;
};

export const fetchAllStargazers = async (repoPath, githubToken) => {
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
};

export const enrichStargazersInBatches = async (stargazers, githubToken) => {
  const enrichedStargazers = [];

  for (let i = 0; i < stargazers.length; i += BATCH_SIZE) {
    const batch = stargazers.slice(i, i + BATCH_SIZE);
    const enrichedBatch = await Promise.all(
      batch.map(async (stargazer) => {
        const userDetails = await fetchUserDetailsWithRetry(stargazer.user.login, githubToken);
        return {
          username: stargazer.user.login,
          profile_url: stargazer.user.html_url,
          email: userDetails.email || "N/A",
          company: userDetails.company || "N/A",
          location: userDetails.location || "N/A",
          website: userDetails.blog || "N/A",
          linkedin: extractLinkedIn(userDetails),
          twitter: userDetails.twitter_username ? `https://twitter.com/${userDetails.twitter_username}` : "N/A",
          bio: userDetails.bio || "N/A",
        };
      })
    );

    enrichedStargazers.push(...enrichedBatch);
    await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
  }

  return enrichedStargazers;
};

const extractLinkedIn = (userDetails) => {
  if (userDetails.blog && userDetails.blog.includes("linkedin.com")) {
    return userDetails.blog;
  }
  return "N/A";
};

const fetchUserDetailsWithRetry = async (username, githubToken, retries = 3) => {
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
};

export const generateCSV = (stargazers) => {
  const headers = ["Username", "GitHub URL", "Email", "Company", "Location", "Website", "LinkedIn", "Twitter", "Bio"];
  const rows = stargazers.map(stargazer => [
    stargazer.username,
    stargazer.profile_url,
    stargazer.email,
    stargazer.company,
    stargazer.location,
    stargazer.website,
    stargazer.linkedin,
    stargazer.twitter,
    stargazer.bio,
  ]);

  const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
  return csvContent;
};

export const downloadCSV = (csvContent, filename) => {
  const blob = new Blob([csvContent], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToExcel = (stargazers) => {
  const ws = XLSX.utils.json_to_sheet(stargazers);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Stargazers");
  XLSX.writeFile(wb, "stargazers.xlsx");
};