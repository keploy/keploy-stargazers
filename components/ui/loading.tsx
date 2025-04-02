export default function Loading() {
  return (
    <div className="mt-4 flex items-center gap-2">
      <div className="w-5 h-5 border-4 border-t-transparent border-blue-500 rounded-full animate-spin"></div>
      <p className="text-blue-500 font-medium">Fetching data...</p>
    </div>
  );
}
