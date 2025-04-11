/* eslint-disable @typescript-eslint/no-explicit-any */

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";
const GITHUB_REST_URL = "https://api.github.com";

let currentTokenIndex = 0;
let GITHUB_TOKENS: string[] = [];

export function setGitHubTokens(tokens: string) {
  // Split tokens by comma and trim whitespace
  GITHUB_TOKENS = tokens
    .split(',')
    .map(token => token.trim())
    .filter(token => token.length > 0);
    
  if (GITHUB_TOKENS.length === 0) {
    throw new Error("At least one valid GitHub token is required");
  }
  currentTokenIndex = 0;
}

function getNextToken(): string {
  // Rotate to next token
  currentTokenIndex = (currentTokenIndex + 1) % GITHUB_TOKENS.length;
  return GITHUB_TOKENS[currentTokenIndex];
}

// Improved error handling and rate limit management
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < retries * GITHUB_TOKENS.length; attempt++) {
    try {
      const token = GITHUB_TOKENS[currentTokenIndex];
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/vnd.github.v3+json"
        },
      });

      if (response.status === 401) {
        // Invalid token, try next one
        getNextToken();
        continue;
      }

      if (response.status === 403) {
        const rateLimitReset = response.headers.get("x-ratelimit-reset");
        if (rateLimitReset) {
          const waitTime = (parseInt(rateLimitReset) * 1000) - Date.now();
          if (waitTime > 0) {
            // If wait time is too long, try next token
            if (waitTime > 60000) {
              getNextToken();
              continue;
            }
            await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 60000)));
            continue;
          }
        }
        // Rate limit hit, try next token
        getNextToken();
        continue;
      }

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      return response;

    } catch (error) {
      lastError = error as Error;
      if (attempt === retries * GITHUB_TOKENS.length - 1) throw lastError;
      getNextToken();
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt % retries)));
    }
  }

  throw lastError || new Error("Failed after multiple retries");
}

export async function fetchAllStargazers(repoPath: string, token: string): Promise<any[]> {
  setGitHubTokens(token);
  const [owner, repo] = repoPath.split("/");
  
  let page = 1;
  const perPage = 100;
  const allStargazers: any[] = [];

  while (true) {
    try {
      const response = await fetchWithRetry(
        `${GITHUB_REST_URL}/repos/${owner}/${repo}/stargazers?page=${page}&per_page=${perPage}`,
        {
          headers: {
            Accept: "application/vnd.github.star+json" // Gets starring timestamp
          }
        }
      );

      const stargazers = await response.json();
      if (!stargazers.length) break;

      allStargazers.push(...stargazers);
      page++;

    } catch (error) {
      console.error("Error fetching stargazers:", error);
      throw error;
    }
  }

  return allStargazers;
}

export async function enrichStargazers(stargazers: any[], token: string): Promise<any[]> {
  setGitHubTokens(token);
  const enrichedStargazers = [];

  for (const stargazer of stargazers) {
    try {
      const response = await fetchWithRetry(
        `${GITHUB_REST_URL}/users/${stargazer.login}`,
        {}
      );

      const userData = await response.json();
      
      enrichedStargazers.push({
        username: userData.login,
        profile_url: userData.html_url,
        email: userData.email || "N/A",
        company: userData.company || "N/A",
        location: userData.location || "N/A",
        Website: userData.blog || "N/A",
        LinkedIn: extractLinkedIn(userData.blog),
        Twitter: userData.twitter_username 
          ? `https://twitter.com/${userData.twitter_username}`
          : "N/A",
        Bio: userData.bio || "N/A",
        starred_at: stargazer.starred_at
      });

    } catch (error) {
      console.error(`Error enriching data for ${stargazer.login}:`, error);
      // Continue with next stargazer if one fails
      enrichedStargazers.push({
        username: stargazer.login,
        profile_url: stargazer.html_url,
        starred_at: stargazer.starred_at,
        // Fill other fields with N/A
        email: "N/A",
        company: "N/A",
        location: "N/A",
        Website: "N/A",
        LinkedIn: "N/A",
        Twitter: "N/A",
        Bio: "N/A"
      });
    }
  }

  return enrichedStargazers;
}

export function extractRepoPath(url: string): string | null {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname !== "github.com") return null;
    
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    if (pathParts.length < 2) return null;
    
    return `${pathParts[0]}/${pathParts[1]}`;
  } catch {
    return null;
  }
}

function extractLinkedIn(websiteUrl: string | null): string {
  if (!websiteUrl) return "N/A";
  
  try {
    const url = new URL(websiteUrl.toLowerCase());
    return url.hostname.includes("linkedin.com") ? websiteUrl : "N/A";
  } catch {
    return "N/A";
  }
}
