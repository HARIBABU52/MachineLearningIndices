export interface RawRecord {
  Date: string;
  Price: string;
  Open: string;
  High: string;
  Low: string;
  "Change %": string;
}

export interface CleanRecord {
  dateStr: string; // DD-MM-YYYY
  timestamp: number;
  price: number;
  open: number;
  high: number;
  low: number;
  change: number; // decimal
  sma50?: number;
  sma200?: number;
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  macdHist?: number;
  drawdown: number; // decimal negative
}

// Clean raw JSON data and sort chronologically (oldest to newest)
export function cleanData(raw: RawRecord[]): CleanRecord[] {
  const parseDate = (dStr: string) => {
    const [d, m, y] = dStr.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d));
  };

  const cleaned: CleanRecord[] = raw.map((r): CleanRecord => {
    const price = parseFloat(r.Price.replace(/,/g, ''));
    const open = parseFloat(r.Open.replace(/,/g, ''));
    const high = parseFloat(r.High.replace(/,/g, ''));
    const low = parseFloat(r.Low.replace(/,/g, ''));
    
    let change = 0;
    if (r["Change %"]) {
      change = parseFloat(r["Change %"].replace(/%/g, '')) / 100;
    }

    const dateObj = parseDate(r.Date);

    return {
      dateStr: r.Date,
      timestamp: dateObj.getTime(),
      price,
      open,
      high,
      low,
      change,
      drawdown: 0
    };
  }).filter(r => !isNaN(r.price) && !isNaN(r.timestamp));

  // Sort chronological (oldest first) for sequential metrics
  cleaned.sort((a, b) => a.timestamp - b.timestamp);

  // Calculate Technical Indicators & Drawdown sequentially
  let peak = -Infinity;
  const prices = cleaned.map(c => c.price);
  
  // Calculate SMA50 & SMA200
  for (let i = 0; i < cleaned.length; i++) {
    const price = cleaned[i].price;
    if (price > peak) peak = price;
    cleaned[i].drawdown = peak > 0 ? (price - peak) / peak : 0;

    // SMA 50
    if (i >= 49) {
      let sum = 0;
      for (let j = i - 49; j <= i; j++) sum += prices[j];
      cleaned[i].sma50 = sum / 50;
    }

    // SMA 200
    if (i >= 199) {
      let sum = 0;
      for (let j = i - 199; j <= i; j++) sum += prices[j];
      cleaned[i].sma200 = sum / 200;
    }
  }

  // Calculate EMAs for MACD (EMA 12, EMA 26)
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macdLine: number[] = [];
  
  for (let i = 0; i < cleaned.length; i++) {
    const val = ema12[i] - ema26[i];
    macdLine.push(val);
    if (i >= 26) {
      cleaned[i].macd = val;
    }
  }

  // MACD Signal line (EMA 9 of MACD Line)
  const macdSignal = calculateEMA(macdLine, 9);
  for (let i = 0; i < cleaned.length; i++) {
    if (i >= 35) { // 26 + 9
      cleaned[i].macdSignal = macdSignal[i];
      cleaned[i].macdHist = (cleaned[i].macd || 0) - macdSignal[i];
    }
  }

  // Calculate RSI (14)
  const rsi = calculateRSI(cleaned, 14);
  for (let i = 0; i < cleaned.length; i++) {
    if (i >= 14) {
      cleaned[i].rsi = rsi[i];
    }
  }

  return cleaned;
}

function calculateEMA(prices: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  if (prices.length === 0) return [];
  
  ema.push(prices[0]); // initial value
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calculateRSI(records: { change: number }[], period: number): number[] {
  const rsi: number[] = new Array(records.length).fill(50);
  if (records.length <= period) return rsi;

  let avgGain = 0;
  let avgLoss = 0;

  // First RSI value
  for (let i = 1; i <= period; i++) {
    const change = records[i].change;
    if (change > 0) {
      avgGain += change;
    } else {
      avgLoss += Math.abs(change);
    }
  }

  avgGain /= period;
  avgLoss /= period;

  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < records.length; i++) {
    const change = records[i].change;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return rsi;
}

// Calculate Summary Statistics
export interface SummaryStats {
  cagr: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  avgReturn: number;
  bestDay: number;
  worstDay: number;
}

export function calculateSummaryStats(records: CleanRecord[]): SummaryStats {
  if (records.length < 2) {
    return { cagr: 0, volatility: 0, sharpeRatio: 0, maxDrawdown: 0, winRate: 0, avgReturn: 0, bestDay: 0, worstDay: 0 };
  }

  const first = records[0];
  const last = records[records.length - 1];
  
  // CAGR
  const years = (last.timestamp - first.timestamp) / (1000 * 60 * 60 * 24 * 365.25);
  const cagr = Math.pow(last.price / first.price, 1 / (years || 1)) - 1;

  // Win rate and daily returns
  const dailyReturns = records.map(r => r.change).slice(1);
  const positiveDays = dailyReturns.filter(r => r > 0).length;
  const winRate = positiveDays / dailyReturns.length;

  const avgReturn = dailyReturns.reduce((sum, val) => sum + val, 0) / dailyReturns.length;
  const bestDay = Math.max(...dailyReturns);
  const worstDay = Math.min(...dailyReturns);

  // Annualized Volatility
  const variance = dailyReturns.reduce((sum, val) => sum + Math.pow(val - avgReturn, 2), 0) / (dailyReturns.length - 1);
  const dailyVol = Math.sqrt(variance);
  const volatility = dailyVol * Math.sqrt(252); // Annualized

  // Sharpe Ratio (assuming 3% risk-free rate)
  const rf = 0.03;
  const sharpeRatio = volatility > 0 ? (cagr - rf) / volatility : 0;

  // Max Drawdown
  const maxDrawdown = Math.min(...records.map(r => r.drawdown));

  return {
    cagr,
    volatility,
    sharpeRatio,
    maxDrawdown,
    winRate,
    avgReturn: avgReturn * 252, // Annualized mean return
    bestDay,
    worstDay
  };
}

// Generate Monthly & Annual returns matrix
export interface HeatmapRow {
  year: number;
  jan: number | null;
  feb: number | null;
  mar: number | null;
  apr: number | null;
  may: number | null;
  jun: number | null;
  jul: number | null;
  aug: number | null;
  sep: number | null;
  oct: number | null;
  nov: number | null;
  dec: number | null;
  total: number | null;
}

export function generateMonthlyHeatmap(records: CleanRecord[]): HeatmapRow[] {
  const yearsSet = new Set<number>();
  records.forEach(r => {
    const [, , y] = r.dateStr.split('-');
    yearsSet.add(Number(y));
  });

  const years = Array.from(yearsSet).sort((a, b) => b - a); // Newest years first

  const heatmap: HeatmapRow[] = [];

  years.forEach(year => {
    const row: any = { year, total: null };
    
    // Group records for this year
    const yearRecords = records.filter(r => {
      const parts = r.dateStr.split('-');
      return Number(parts[2]) === year;
    });

    const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

    for (let month = 0; month < 12; month++) {
      const key = monthKeys[month];
      
      // Get records for this specific month
      const monthRecords = yearRecords.filter(r => {
        const parts = r.dateStr.split('-');
        return Number(parts[1]) === month + 1;
      });

      if (monthRecords.length > 0) {
        // Calculate return for this month: (End price - Start open price) / Start open price
        const startPrice = monthRecords[0].open;
        const endPrice = monthRecords[monthRecords.length - 1].price;
        row[key] = (endPrice - startPrice) / startPrice;
      } else {
        row[key] = null;
      }
    }

    // Annual return: (End price of year - Start price of year) / Start price of year
    if (yearRecords.length > 0) {
      const startPrice = yearRecords[0].open;
      const endPrice = yearRecords[yearRecords.length - 1].price;
      row.total = (endPrice - startPrice) / startPrice;
    } else {
      row.total = null;
    }

    heatmap.push(row);
  });

  return heatmap;
}

// Generate Distribution Histogram
export interface HistogramBin {
  binLabel: string;
  count: number;
}

export function generateHistogram(records: CleanRecord[], binSize = 0.005): HistogramBin[] {
  const returns = records.map(r => r.change).slice(1);
  if (returns.length === 0) return [];

  const minBin = -0.05;
  const maxBin = 0.05;
  const numBins = Math.round((maxBin - minBin) / binSize) + 2; 
  
  const bins = Array.from({ length: numBins }, (_, i) => {
    let label = '';
    let minRange = 0;
    let maxRange = 0;
    if (i === 0) {
      label = '< -5.0%';
      minRange = -Infinity;
      maxRange = minBin;
    } else if (i === numBins - 1) {
      label = '> 5.0%';
      minRange = maxBin;
      maxRange = Infinity;
    } else {
      minRange = minBin + (i - 1) * binSize;
      maxRange = minRange + binSize;
      label = `${(minRange * 100).toFixed(1)}% to ${(maxRange * 100).toFixed(1)}%`;
    }
    return {
      binLabel: label,
      minRange,
      maxRange,
      count: 0
    };
  });

  returns.forEach(ret => {
    for (let i = 0; i < bins.length; i++) {
      if (ret >= bins[i].minRange && ret < bins[i].maxRange) {
        bins[i].count++;
        break;
      }
    }
  });

  return bins.map(b => ({ binLabel: b.binLabel, count: b.count }));
}

// Run Monte Carlo Simulation
export interface MonteCarloPath {
  name: string;
  data: { day: number; price: number }[];
}

export function runMonteCarlo(
  latestPrice: number,
  annualReturn: number,
  annualVol: number,
  numDays = 252,
  numPaths = 5
): MonteCarloPath[] {
  const dt = 1 / 252;
  const dailyMu = annualReturn / 252;
  const dailySigma = annualVol / Math.sqrt(252);

  const paths: MonteCarloPath[] = [];

  const randomNormal = () => {
    let u = 0, v = 0;
    while(u === 0) u = Math.random(); 
    while(v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  };

  for (let p = 0; p < numPaths; p++) {
    const data = [{ day: 0, price: latestPrice }];
    let currentPrice = latestPrice;

    for (let day = 1; day <= numDays; day++) {
      const z = randomNormal();
      const drift = (dailyMu - 0.5 * Math.pow(dailySigma, 2));
      const shock = dailySigma * z;
      currentPrice = currentPrice * Math.exp(drift + shock);
      data.push({ day, price: Number(currentPrice.toFixed(2)) });
    }

    paths.push({
      name: `Path ${p + 1}`,
      data
    });
  }

  return paths;
}

// Stress testing crash scenarios
export interface StressTestScenario {
  name: string;
  period: string;
  description: string;
  peakPrice: number;
  troughPrice: number;
  decline: number;
  daysToTrough: number;
  recoveryDays: string;
}

export const CRASH_SCENARIOS: StressTestScenario[] = [
  {
    name: "Dot-com Bubble Burst",
    period: "2000 - 2002",
    description: "Technology sector crash following extreme speculation, compounding into a 2.5-year bear market.",
    peakPrice: 1527.46,
    troughPrice: 776.76,
    decline: -0.4915,
    daysToTrough: 929,
    recoveryDays: "2,060"
  },
  {
    name: "2008 Global Financial Crisis",
    period: "2007 - 2009",
    description: "Subprime mortgage collapse triggering a global banking liquidity crisis and severe economic recession.",
    peakPrice: 1565.15,
    troughPrice: 676.53,
    decline: -0.5678,
    daysToTrough: 517,
    recoveryDays: "1,440"
  },
  {
    name: "2020 COVID-19 Flash Crash",
    period: "Feb - Mar 2020",
    description: "Rapid decline driven by pandemic shutdowns, followed by unprecedented central bank intervention and a swift V-shaped recovery.",
    peakPrice: 3386.15,
    troughPrice: 2237.40,
    decline: -0.3392,
    daysToTrough: 33,
    recoveryDays: "148"
  }
];
