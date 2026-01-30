
// Helper function to introduce a delay
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper functions for Technical Indicators

/**
 * Calculates Simple Moving Average (SMA).
 * @param {Array<number>} data - Array of closing prices.
 * @param {number} period - The period for SMA calculation.
 * @returns {Array<number>} - Array of SMA values.
 */
function calculateSMA(data, period) {
    const sma = [];
    for (let i = 0; i < data.length - period + 1; i++) {
        const slice = data.slice(i, i + period);
        const sum = slice.reduce((a, b) => a + b, 0);
        sma.push(sum / period);
    }
    return sma;
}

/**
 * Calculates Relative Strength Index (RSI).
 * @param {Array<number>} data - Array of closing prices.
 * @param {number} period - The period for RSI calculation.
 * @returns {Array<number>} - Array of RSI values.
 */
function calculateRSI(data, period) {
    const rsi = [];
    if (data.length < period) return rsi;

    let avgGain = 0;
    let avgLoss = 0;

    // Calculate initial average gain and loss
    for (let i = 1; i <= period; i++) {
        const change = data[i] - data[i - 1];
        if (change > 0) {
            avgGain += change;
        } else {
            avgLoss += Math.abs(change);
        }
    }
    avgGain /= period;
    avgLoss /= period;

    for (let i = period + 1; i < data.length; i++) {
        const change = data[i] - data[i - 1];
        let currentGain = 0;
        let currentLoss = 0;

        if (change > 0) {
            currentGain = change;
        } else {
            currentLoss = Math.abs(change);
        }

        avgGain = (avgGain * (period - 1) + currentGain) / period;
        avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

        const rs = avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
    }
    return rsi;
}

/**
 * Calculates Exponential Moving Average (EMA). Helper for MACD.
 * @param {Array<number>} data - Array of closing prices.
 * @param {number} period - The period for EMA calculation.
 * @returns {Array<number>} - Array of EMA values.
 */
function calculateEMA(data, period) {
    const ema = [];
    if (data.length < period) return ema;

    const multiplier = 2 / (period + 1);
    ema[period - 1] = data.slice(0, period).reduce((sum, val) => sum + val, 0) / period; // Initial SMA

    for (let i = period; i < data.length; i++) {
        ema[i] = (data[i] - ema[i - 1]) * multiplier + ema[i - 1];
    }
    return ema.slice(period - 1);
}

/**
 * Calculates Moving Average Convergence Divergence (MACD).
 * @param {Array<number>} data - Array of closing prices.
 * @param {number} fastPeriod - The period for the fast EMA (e.g., 12).
 * @param {number} slowPeriod - The period for the slow EMA (e.g., 26).
 * @param {number} signalPeriod - The period for the signal line EMA (e.g., 9).
 * @returns {{macdLine: Array<number>, signalLine: Array<number>, histogram: Array<number>}} - MACD components.
 */
function calculateMACD(data, fastPeriod, slowPeriod, signalPeriod) {
    const fastEMA = calculateEMA(data, fastPeriod);
    const slowEMA = calculateEMA(data, slowPeriod);

    // Ensure EMAs are of the same length by trimming the longer one
    const minLength = Math.min(fastEMA.length, slowEMA.length);
    const macdLine = [];
    for (let i = 0; i < minLength; i++) {
        macdLine.push(fastEMA[fastEMA.length - minLength + i] - slowEMA[slowEMA.length - minLength + i]);
    }

    const signalLine = calculateEMA(macdLine, signalPeriod);

    const histogram = [];
    const minHistogramLength = Math.min(macdLine.length, signalLine.length);
    for (let i = 0; i < minHistogramLength; i++) {
        histogram.push(macdLine[macdLine.length - minHistogramLength + i] - signalLine[signalLine.length - minHistogramLength + i]);
    }

    return { macdLine, signalLine, histogram };
}

class StockRecommendation extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });

        const wrapper = document.createElement('div');
        wrapper.setAttribute('class', 'stock-card');

        const name = this.getAttribute('name');
        const ticker = this.getAttribute('ticker');
        const reason = this.getAttribute('reason');
        const latestPrice = this.getAttribute('latest-price');
        const sma20 = this.getAttribute('sma20');
        const rsi14 = this.getAttribute('rsi14');
        const macdLine = this.getAttribute('macd-line');
        const signalLine = this.getAttribute('signal-line');
        const histogram = this.getAttribute('histogram');
        const recommendation = this.getAttribute('recommendation');

        wrapper.innerHTML = `
            <h2>${name} (${ticker})</h2>
            <div class="stock-info">
                <p><strong>최신 가격:</strong> $${latestPrice}</p>
                <p><strong>SMA(20):</strong> ${sma20}</p>
                <p><strong>RSI(14):</strong> ${rsi14}</p>
                <p><strong>MACD 선:</strong> ${macdLine}</p>
                <p><strong>시그널 선:</strong> ${signalLine}</p>
                <p><strong>히스토그램:</strong> ${histogram}</p>
                <p><strong>추천:</strong> ${recommendation}</p>
                <p><strong>사유:</strong> ${reason}</p>
                <div class="chart-placeholder">간단한 차트</div>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            h2 {
                color: var(--text-color);
            }
            p {
                color: var(--text-color);
                margin: 5px 0;
            }
            .stock-card {
                border-bottom: 1px solid var(--border-color);
                padding-bottom: 20px;
                transition: border-bottom 0.2s;
            }
            .chart-placeholder {
                width: 150px;
                height: 80px;
                background-color: var(--bg-color);
                display: flex;
                justify-content: center;
                align-items: center;
                color: var(--subtle-text-color);
                transition: background-color 0.2s, color 0.2s;
                margin-top: 10px;
            }
        `;

        shadow.appendChild(style);
        shadow.appendChild(wrapper);
    }
}

customElements.define('stock-recommendation', StockRecommendation);

// --- Alpha Vantage API Configuration ---
const ALPHA_VANTAGE_API_KEY = '1D4KMGHILXDEKMP4';
const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query';
// Keeping the FMP key for reference, but it's not being used for API calls
// const FMP_API_KEY = 'M5NC0pcUPmjvGTDDnlhWUQkKkTA2QXWn';
// const FMP_BASE_URL = 'https://financialmodelingprep.com/v3/historical-price-full/';

// --- Stock Recommendation Logic ---
const targetTickers = ['AAPL']; // Reduced to 1 to accommodate Alpha Vantage free tier daily limit
const stockListElement = document.getElementById('stock-list');

async function fetchAndRecommendStocks() {
    stockListElement.innerHTML = '<p>주식 데이터를 불러오는 중입니다...</p>'; // Loading indicator

    const recommendedStocks = [];

    for (const ticker of targetTickers) {
        try {
            const url = `${ALPHA_VANTAGE_BASE_URL}?function=TIME_SERIES_DAILY&symbol=${ticker}&apikey=${ALPHA_VANTAGE_API_KEY}`;
            const response = await fetch(url);
            const data = await response.json();
            // Always log for debugging
            console.log(`Full API response for ${ticker} (always):`, data);

            if (data['Error Message']) {
                console.error(`Error fetching data for ${ticker}: ${data['Error Message']}`);
                recommendedStocks.push({
                    ticker: ticker,
                    name: ticker,
                    latestPrice: 'N/A',
                    sma20: 'N/A',
                    rsi14: 'N/A',
                    macdLine: 'N/A',
                    signalLine: 'N/A',
                    histogram: 'N/A',
                    recommendation: '데이터 로드 실패',
                    reason: `데이터를 불러올 수 없습니다: ${data['Error Message']}`
                });
                continue;
            }
            if (!data['Time Series (Daily)']) {
                console.warn(`No daily time series data for ${ticker}. Possibly invalid ticker or API limit reached.`);
                 recommendedStocks.push({
                    ticker: ticker,
                    name: ticker,
                    latestPrice: 'N/A',
                    sma20: 'N/A',
                    rsi14: 'N/A',
                    macdLine: 'N/A',
                    signalLine: 'N/A',
                    histogram: 'N/A',
                    recommendation: '데이터 없음',
                    reason: `일별 시계열 데이터가 없습니다. (API 한도 도달 또는 잘못된 티커)`
                });
                continue;
            }

            const timeSeries = data['Time Series (Daily)'];
            const dates = Object.keys(timeSeries).sort(); // Sort by date ascending
            const prices = dates.map(date => parseFloat(timeSeries[date]['4. close']));

            console.log(`[DEBUG] Ticker: ${ticker}, Prices Length: ${prices.length}`); // Debugging line to see data points

            if (prices.length === 0) { // No data at all
                console.log(`[DEBUG] No prices data for ${ticker}, pushing '데이터 없음' fallback.`);
                recommendedStocks.push({
                    ticker: ticker,
                    name: data['Meta Data']['2. Symbol'] || ticker,
                    latestPrice: 'N/A', sma20: 'N/A', rsi14: 'N/A', macdLine: 'N/A', signalLine: 'N/A', histogram: 'N/A',
                    recommendation: '데이터 없음',
                    reason: `데이터를 불러올 수 없습니다. (${ticker})`
                });
                // No need for sleep here as we continue.
                continue;
            }

            // Always try to get latest price even if data is short
            const latestPrice = prices[prices.length - 1];

            let latestSMA20 = 'N/A';
            let latestRSI14 = 'N/A';
            let latestMACDLine = 'N/A';
            let latestSignalLine = 'N/A';
            let latestHistogram = 'N/A';

            let recommendation = '데이터 부족';
            let reason = `지표 계산에 필요한 데이터 부족 (${prices.length}개)`;

            if (prices.length >= 30) { // Enough data for all indicators
                const sma20 = calculateSMA(prices, 20);
                latestSMA20 = sma20.length > 0 ? sma20[sma20.length - 1].toFixed(2) : 'N/A';

                const rsi14 = calculateRSI(prices, 14);
                latestRSI14 = rsi14.length > 0 ? rsi14[rsi14.length - 1].toFixed(2) : 'N/A';

                const macd = calculateMACD(prices, 12, 26, 9);
                latestMACDLine = macd.macdLine.length > 0 ? macd.macdLine[macd.macdLine.length - 1].toFixed(2) : 'N/A';
                latestSignalLine = macd.signalLine.length > 0 ? macd.signalLine[macd.signalLine.length - 1].toFixed(2) : 'N/A';
                latestHistogram = macd.histogram.length > 0 ? macd.histogram[macd.histogram.length - 1].toFixed(2) : 'N/A';

                // Original Simple Recommendation Logic
                recommendation = '관망';
                reason = '지표를 분석 중입니다.';

                if (latestRSI14 !== 'N/A' && latestMACDLine !== 'N/A' && latestSignalLine !== 'N/A' &&
                    !isNaN(parseFloat(latestRSI14)) && !isNaN(parseFloat(latestMACDLine)) && !isNaN(parseFloat(latestSignalLine))) {

                    const rsiVal = parseFloat(latestRSI14);
                    const macdVal = parseFloat(latestMACDLine);
                    const signalVal = parseFloat(latestSignalLine);

                    const prevMACDLine = macd.macdLine[macd.macdLine.length - 2];
                    const prevSignalLine = macd.signalLine[macd.signalLine.length - 2];

                    if (rsiVal < 30 && macdVal > signalVal && prevMACDLine <= prevSignalLine) {
                        recommendation = '매수 추천';
                        reason = `RSI(14) ${rsiVal}로 과매도 구간이며, MACD선이 시그널선을 상향 돌파했습니다.`;
                    } else if (rsiVal > 70 && macdVal < signalVal && prevMACDLine >= prevSignalLine) {
                        recommendation = '매도 추천';
                        reason = `RSI(14) ${rsiVal}로 과매수 구간이며, MACD선이 시그널선을 하향 돌파했습니다.`;
                    } else if (latestPrice !== 'N/A' && latestSMA20 !== 'N/A' && !isNaN(parseFloat(latestPrice)) && !isNaN(parseFloat(latestSMA20))) {
                        const priceVal = parseFloat(latestPrice);
                        const smaVal = parseFloat(latestSMA20);
                        if (priceVal > smaVal) {
                            recommendation = '유지 (상승 추세)';
                            reason = `현재 가격이 SMA(20) 위에 있습니다.`;
                        } else if (priceVal < smaVal) {
                            recommendation = '유지 (하락 추세)';
                            reason = `현재 가격이 SMA(20) 아래에 있습니다.`;
                        }
                    }
                }
            }

            console.log(`[DEBUG] ${ticker} Indicators:`, {
                latestPrice, latestSMA20, latestRSI14, latestMACDLine, latestSignalLine, latestHistogram
            });
            console.log(`[DEBUG] ${ticker} Recommendation:`, { recommendation, reason });
            
            recommendedStocks.push({
                ticker: ticker,
                name: data['Meta Data']['2. Symbol'] || ticker, // Use name from API if available
                latestPrice: latestPrice,
                sma20: latestSMA20,
                rsi14: latestRSI14,
                macdLine: latestMACDLine,
                signalLine: latestSignalLine,
                histogram: latestHistogram,
                recommendation: recommendation,
                reason: reason
            });
            console.log(`[DEBUG] recommendedStocks after push for ${ticker}:`, recommendedStocks.length, recommendedStocks);

            // Introduce a delay to respect API rate limits (5 calls per minute for free tier)
            await sleep(20000); // 20 seconds delay

        } catch (error) {
            console.error(`Failed to fetch data for ${ticker}:`, error);
            recommendedStocks.push({
                ticker: ticker,
                name: data['Meta Data']['2. Symbol'] || ticker, // Use name from API if available
                latestPrice: 'N/A',
                sma20: 'N/A',
                rsi14: 'N/A',
                macdLine: 'N/A',
                signalLine: 'N/A',
                histogram: 'N/A',
                recommendation: '오류 발생',
                reason: `데이터를 불러오는 중 오류가 발생했습니다: ${error.message}`
            });
            console.log(`[DEBUG] recommendedStocks after error push for ${ticker}:`, recommendedStocks.length, recommendedStocks);
            // Still introduce delay even on error to avoid further rate limit issues
            await sleep(20000); // 20 seconds delay
        }
    }

    console.log(`[DEBUG] Final recommendedStocks array before rendering:`, recommendedStocks.length, recommendedStocks);
    stockListElement.innerHTML = ''; // Clear loading indicator

    if (recommendedStocks.length === 0) {
        console.warn("[DEBUG] recommendedStocks array is empty, no elements will be rendered.");
        stockListElement.innerHTML = '<p>표시할 주식 추천이 없습니다.</p>';
        return;
    }

    recommendedStocks.forEach(stock => {
        console.log("[DEBUG] Processing stock for rendering:", stock); // Log stock object
        const stockElement = document.createElement('stock-recommendation');
        stockElement.setAttribute('name', stock.name);
        stockElement.setAttribute('ticker', stock.ticker);
        stockElement.setAttribute('reason', stock.reason);
        stockElement.setAttribute('latest-price', stock.latestPrice !== 'N/A' ? stock.latestPrice : 'N/A');
        stockElement.setAttribute('sma20', stock.sma20 !== 'N/A' ? stock.sma20 : 'N/A');
        stockElement.setAttribute('rsi14', stock.rsi14 !== 'N/A' ? stock.rsi14 : 'N/A');
        stockElement.setAttribute('macd-line', stock.macdLine !== 'N/A' ? stock.macdLine : 'N/A');
        
        stockElement.setAttribute('signal-line', stock.signalLine !== 'N/A' ? stock.signalLine : 'N/A');
        stockElement.setAttribute('histogram', stock.histogram !== 'N/A' ? stock.histogram : 'N/A');
        
        stockElement.setAttribute('recommendation', stock.recommendation);
        stockListElement.appendChild(stockElement);
        console.log("[DEBUG] Stock element appended:", stockElement); // Confirm append
    });
}

// Initial call to fetch and recommend stocks
fetchAndRecommendStocks();

// --- Theme Toggle Script ---
const themeToggle = document.getElementById('theme-toggle');
const htmlElement = document.documentElement;

// 1. On page load, check for saved theme in localStorage
const savedTheme = localStorage.getItem('theme') || 'light';
htmlElement.setAttribute('data-theme', savedTheme);

// 2. Add event listener to the toggle button
themeToggle.addEventListener('click', () => {
    const currentTheme = htmlElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    htmlElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme); // 3. Save the new theme preference
});