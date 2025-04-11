/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Loading from "@/components/ui/loading";
import { useState } from "react";
import DataExport from "@/components/data-handlers/DataExport";
import {
  extractRepoPath,
  fetchAllStargazers,
  enrichStargazers,
} from "@/services/githubServices";

import { Eye, EyeOff } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [githubTokens, setGithubTokens] = useState("");
  const [showTokens, setShowTokens] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stargazers, setStargazers] = useState<any[]>([]);
  const [last24Hours, setLast24Hours] = useState<boolean>(false);
  const [hasFetched, setHasFetched] = useState(false);

  const handleFetchStargazers = async (last24Hours = false) => {
    if (!repoUrl || !githubTokens) {
      alert("Invalid GitHub repository URL or token");
      return;
    }
    setLoading(true);
    setHasFetched(false);

    try {
      const repoPath = extractRepoPath(repoUrl);
      if (!repoPath) throw new Error("Invalid repository URL");
      let stargazers = await fetchAllStargazers(repoPath, githubTokens);

      if (last24Hours) {
        const last24hTimestamp = new Date();
        last24hTimestamp.setDate(last24hTimestamp.getDate() - 1);
        stargazers = stargazers.filter(
          (star) => new Date(star.starred_at) >= last24hTimestamp
        );
      }

      const enrichedStargazers = await enrichStargazers(stargazers, githubTokens);
      setStargazers(enrichedStargazers);
    } catch (error) {
      console.error(error);
      alert("Error fetching stargazers");
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#0D1117]">
      <Card className="w-[500px] flex flex-col items-center p-6 bg-[#161B22]">
        <CardHeader>
          <CardTitle className="text-[#C9D1D9] text-3xl">GitHub Stargazers Data</CardTitle>
        </CardHeader>
        <CardContent className="w-[500px]">
          <form>
            <div className="grid w-full items-center gap-4">
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="name" className="text-[#C9D1D9]">Github Repository URL</Label>
                <Input
                  type="text"
                  placeholder="Enter GitHub Repository URL (e.g., https://github.com/owner/repo)"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="border p-2 mb-2 w-full max-w-md bg-[#0D1117] text-white"
                />
              </div>
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="name" className="text-[#C9D1D9]">Your Personal Tokens</Label>
                <div className="relative w-full max-w-md">
                  <Input
                    type={showTokens ? "text" : "password"}
                    placeholder="Enter GitHub Tokens (comma-separated, at least one required e.g., ghp_token1, ghp_token2)"
                    value={githubTokens}
                    onChange={(e) => setGithubTokens(e.target.value)}
                    className="border p-2 w-full bg-[#0D1117] text-white"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-2 flex items-center"
                    onClick={() => setShowTokens(!showTokens)}
                  >
                    {showTokens ? <Eye size={20} className="text-white"  /> : <EyeOff size={20} className="text-white" />}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-4 w-[500px]">
          <Button
            onClick={() => handleFetchStargazers(false)}
            className="bg-green-500 text-white p-2 w-full"
          >
            Fetch Stargazers
          </Button>
          <Button
            onClick={() => handleFetchStargazers(true)}
            className="bg-green-500 text-white p-2 w-full"
          >
            Fetch Last 24H
          </Button>
        </CardFooter>
        {loading && <Loading />}
        {hasFetched && stargazers.length > 0 ? (
          <DataExport
            stargazers={stargazers}
            last24Hours={last24Hours}
            setLast24Hours={setLast24Hours}
          />
        ) : hasFetched && !loading ? (
          <p className="mt-4 text-gray-500">No data available</p>
        ) : null}
      </Card>
    </div>
  );
}
