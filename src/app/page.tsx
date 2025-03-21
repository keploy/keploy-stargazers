"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  downloadCSV,
  enrichStargazersInBatches,
  exportToExcel,
  extractRepoPath,
  fetchAllStargazers,
  generateCSV,
} from "@/lib/githubutils";

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stargazers, setStargazers] = useState<any[]>([]);
  const [isEmpty, setIsEmpty]=useState(false);

  const fetchStargazers = async (last24Hours = false) => {
    setLoading(true);
    setError(null);

    try {
      const repoPath = extractRepoPath(repoUrl);
      let stargazers = await fetchAllStargazers(repoPath, token);
      if (last24Hours) {
        const last24hTimestamp = new Date();
        last24hTimestamp.setDate(last24hTimestamp.getDate() - 1);

        stargazers = stargazers.filter(
          (star) => new Date(star.starred_at) >= last24hTimestamp
        );
        
      }
      const enrichedStargazers = await enrichStargazersInBatches(
        stargazers,
        token
      );
      if(enrichedStargazers.length==0){
        setIsEmpty(true);
      }
      setStargazers(enrichedStargazers);
      
  console.log(enrichedStargazers);
      const csvData = generateCSV(enrichedStargazers);
      downloadCSV(
        csvData,
        last24Hours ? "stargazers_last_24h.csv" : "stargazers.csv"
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    } finally {
      setLoading(false);
    }

  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black p-4">
      <Card className="w-full max-w-md p-8 bg-[#111827] border-none text-white">
        <h1 className="text-2xl font-bold text-center mb-6 text-white">
          GitHub Stargazers Data
        </h1>

        <div className="space-y-4">
          <Input
            placeholder="Enter GitHub Repository URL (e.g., https://github.com/owner/repo)"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            className="bg-[#1f2937] border-none text-gray-300 placeholder:text-gray-500"
          />

          <Input
            type="password"
            placeholder="Enter GitHub Token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="bg-[#1f2937] border-none text-gray-300 placeholder:text-gray-500"
          />

          <Button
            onClick={() => fetchStargazers(false)}
            disabled={loading || !repoUrl}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Fetch Stargazers
          </Button>

          <Button
            onClick={() => fetchStargazers(true)}
            disabled={loading || !repoUrl}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Fetch Last 24 Hours
          </Button>

          {error && (
            <div className="text-red-500 text-sm mt-2">Error: {error}</div>
          )}


          {isEmpty && stargazers.length==0 && <div className="mt-4">
              <h2 className="text-lg font-semibold mb-2">
                Results ({stargazers.length})
              </h2>
            </div> }

          {stargazers.length > 0 && (
            <div className="mt-4">
              <h2 className="text-lg font-semibold mb-2">
                Results ({stargazers.length})
              </h2>
              <Button
            onClick={() => exportToExcel(stargazers)}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            Exoort to Excel
          </Button>
            </div>
          )}
        </div>
      </Card>
    </main>
  );
}
