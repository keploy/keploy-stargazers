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


export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stargazers, setStargazers] = useState<any[]>([]);
  const [last24Hours, setLast24Hours] = useState<boolean>(false);
  const [hasFetched, setHasFetched] = useState(false);


  const handleFetchStargazers = async (last24Hours = false) => {
    if (!repoUrl || !githubToken) {
      alert("Invalid GitHub repository URL or token");
      return;
    }
    setLoading(true);
    setHasFetched(false);

    try {
      const repoPath = extractRepoPath(repoUrl);
      if (!repoPath) throw new Error("Invalid repository URL");
      let stargazers = await fetchAllStargazers(repoPath, githubToken);

      if (last24Hours) {
        const last24hTimestamp = new Date();
        last24hTimestamp.setDate(last24hTimestamp.getDate() - 1);
        stargazers = stargazers.filter(
          (star) => new Date(star.starred_at) >= last24hTimestamp
        );
      }

      const enrichedStargazers = await enrichStargazers(
        stargazers,
        githubToken
      );
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
    <div className="flex flex-col items-center p-6">
      <h1 className="text-2xl font-bold mb-4">GitHub Stargazers Data</h1>
      <Input
        type="text"
        placeholder="Enter GitHub Repository URL"
        value={repoUrl}
        onChange={(e) => setRepoUrl(e.target.value)}
        className="border p-2 mb-2 w-full max-w-md"
      />
      <div className="relative w-full max-w-md">
        <Input
          type={showToken ? "text" : "password"}
          placeholder="Enter GitHub Token"
          value={githubToken}
          onChange={(e) => setGithubToken(e.target.value)}
          className="border p-2 w-full"
        />
        <button
          type="button"
          className="absolute inset-y-0 right-2 flex items-center"
          onClick={() => setShowToken(!showToken)}
        >
          {showToken ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
      <div className="flex gap-4 mt-2">
        <Button
          onClick={() => handleFetchStargazers(false)}
          className="bg-blue-500 text-white p-2"
        >
          Fetch Stargazers
        </Button>
        <Button
          onClick={() => handleFetchStargazers(true)}
          className="bg-green-500 text-white p-2"
        >
          Fetch Last 24H
        </Button>
      </div>
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
    </div>
  );
}
