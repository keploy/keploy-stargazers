/* eslint-disable @typescript-eslint/no-explicit-any */
const GITHUB_API_URL = "https://api.github.com";
const BATCH_SIZE = 50;
const DELAY_BETWEEN_REQUESTS = 2000;

export const extractRepoPath = (url: string) => {
  const match = url.match(/github\.com\/([^\/]+\/[^\/]+)/);
  return match ? match[1] : null;
};

export const fetchAllStargazers = async (repoPath: string, token: string) => {
  let stargazers: any[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(
      `${GITHUB_API_URL}/repos/${repoPath}/stargazers?page=${page}&per_page=100`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3.star+json",
        },
      }
    );

    if (!response.ok) throw new Error("Failed to fetch stargazers");
    const data = await response.json();
    stargazers = stargazers.concat(data);
    hasMore = data.length === 100;
    page++;
  }
  return stargazers;
};

export const fetchUserDetails = async (username: string, token: string) => {
  const response = await fetch(`${GITHUB_API_URL}/users/${username}`, {
    headers: { Authorization: `token ${token}` },
  });
  if (!response.ok) return null;
  return response.json();
};

export const enrichStargazers = async (stargazers: any[], token: string) => {
  const enriched: any[] = [];
  for (let i = 0; i < stargazers.length; i += BATCH_SIZE) {
    const batch = stargazers.slice(i, i + BATCH_SIZE);
    const enrichedBatch = await Promise.all(
      batch.map(async (star) => {
        const userDetails = await fetchUserDetails(star.user.login, token);
        return {
          username: star.user.login,
          profile_url: star.user.html_url,
          email: userDetails?.email || "N/A",
          company: userDetails?.company || "N/A",
          location: userDetails?.location || "N/A",
          Website: userDetails?.blog || "NA",
          LinkedIn: userDetails?.linkedIn_username || "N/A",
          Twitter: userDetails?.twitter_username || "N/A",
          Bio: userDetails?.bio || "N/A",
        };
      })
    );
    enriched.push(...enrichedBatch);
    await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
  }
  return enriched;
};
