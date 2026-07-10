import fs from "fs";
import path from "path";
import Dashboard from "@/components/Dashboard";
import { cleanData, RawRecord } from "@/utils/analytics";

export const metadata = {
  title: "S&P 500 Advanced Analytics Dashboard",
  description: "Interactive quantitative analysis, rolling statistics, technical indicators, and Monte Carlo simulations of the S&P 500 index.",
};

export default function Home() {
  // Read historical dataset from JSON
  const dataPath = path.join(process.cwd(), "src", "data", "S&P500-HistoricData.json");
  const rawData: RawRecord[] = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  
  // Clean and prepare data sequentially on the server side
  const cleanedData = cleanData(rawData);

  return <Dashboard initialData={cleanedData} />;
}
