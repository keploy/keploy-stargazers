// lib/csv.ts

export function generateCSV(stargazers: any[]) {
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
    "Starred At"
  ];
  
  const rows = stargazers.map((s) => [
    s.username,
    s.profile_url,
    s.email,
    s.company,
    s.location,
    s.Website,
    s.LinkedIn,
    s.Twitter,
    s.Bio,
    s.starred_at
  ].map(value => `"${String(value).replace(/"/g, '""')}"`));

  const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "stargazers.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
  
