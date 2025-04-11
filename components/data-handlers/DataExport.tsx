/* eslint-disable @typescript-eslint/no-explicit-any */
import * as XLSX from "xlsx";
import { Button } from "../ui/button";
import { generateCSV } from "@/lib/csv";
import { Download } from "lucide-react";

interface DataExportProps {
  stargazers: any[];
  last24Hours: boolean;
  setLast24Hours: (value: boolean) => void;
}

const DataExport: React.FC<DataExportProps> = ({ stargazers, last24Hours, setLast24Hours }) => {
  const handleCSVExport = () => {
    generateCSV(stargazers);
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
    <div className="flex flex-col space-y-2 w-full">
      <Button
        onClick={handleCSVExport}
        variant="outline"
        className="w-full"
      >
        <Download className="mr-2 h-4 w-4" />
        Download CSV
      </Button>
      <Button
        onClick={exportToExcel}
        variant="outline"
        className="w-full"
      >
        <Download className="mr-2 h-4 w-4" />
        Export to Excel
      </Button>
    </div>
  );
};

export default DataExport;
