/* eslint-disable @typescript-eslint/no-explicit-any */
import * as XLSX from "xlsx";
import { Button } from "../ui/button";

interface DataExportProps {
  stargazers: any[];
  last24Hours: boolean;
  setLast24Hours: (value: boolean) => void;
}

const DataExport: React.FC<DataExportProps> = ({ stargazers, last24Hours, setLast24Hours }) => {
  const exportToCSV = () => {
    const headers = [
      "Username",
      "GitHub URL",
      "Email",
      "Company",
      "Location",
      "Website",
      "Linkedin",
      "Twitter",
      "Bio",
    ];
    const DataHeaders =  [
      "username",
      "profile_url",
      "email",
      "company",
      "location",
      "Website",
      "LinkedIn",
      "Twitter",
      "Bio",
    ]
    const rows = stargazers.map((s) =>
      DataHeaders.map((header) => {
        const value = s[header] ?? "N/A";
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(",")
    );
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = last24Hours ? "stargazers_last_24_hrs.csv" : "stargazers.csv";
    link.click();
    setLast24Hours(false);
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(stargazers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stargazers");
    XLSX.writeFile(wb, last24Hours ? "stargazers_last_24_hrs.xlsx" : "stargazers.xlsx");
    setLast24Hours(false);
  };

  return (
    <div className="flex flex-col items-center space-y-4 w-full">
      <Button onClick={exportToCSV} className="bg-green-500 text-white p-2 w-full">
        Download CSV
      </Button>
      <Button onClick={exportToExcel} className="bg-green-500 text-white p-2 w-full">
        Export to Excel
      </Button>
    </div>
  );
};

export default DataExport;
