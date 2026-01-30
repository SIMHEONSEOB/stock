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

// --- Mock Historical Data ---
// In a real application, this data would be fetched from a financial API.
const historicalData = {
    'AAPL': [170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 198, 195, 192, 190, 188, 185, 183, 180], // 40 days
    'MSFT': [290, 291, 292, 293, 294, 295, 296, 297, 298, 299, 300, 301, 302, 303, 304, 305, 306, 307, 308, 309, 310, 311, 312, 313, 314, 315, 316, 317, 318, 319, 320, 318, 315, 312, 310, 308, 305, 303, 300], // 40 days
    'AMZN': [130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 158, 155, 152, 150, 148, 145, 143, 140], // 40 days
    'GOOGL': [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 128, 125, 122, 120, 118, 115, 113, 110], // 40 days
    'NVDA': [400, 405, 410, 415, 420, 425, 430, 435, 440, 445, 450, 455, 460, 465, 470, 475, 480, 485, 490, 495, 500, 505, 510, 515, 520, 525, 530, 535, 540, 545, 550, 540, 530, 520, 510, 500, 490, 480, 470] // 40 days
};

// --- Stock Recommendation Logic ---
const recommendedStocks = [];

for (const ticker in historicalData) {
    const prices = historicalData[ticker];
    if (prices.length < 30) continue; // Need enough data for indicators

    const latestPrice = prices[prices.length - 1];

    // Calculate Indicators
    const sma20 = calculateSMA(prices, 20);
    const latestSMA20 = sma20.length > 0 ? sma20[sma20.length - 1] : 'N/A';

    const rsi14 = calculateRSI(prices, 14);
    const latestRSI14 = rsi14.length > 0 ? rsi14[rsi14.length - 1] : 'N/A';

    const macd = calculateMACD(prices, 12, 26, 9);
    const latestMACDLine = macd.macdLine.length > 0 ? macd.macdLine[macd.macdLine.length - 1] : 'N/A';
    const latestSignalLine = macd.signalLine.length > 0 ? macd.signalLine[macd.signalLine.length - 1] : 'N/A';
    const latestHistogram = macd.histogram.length > 0 ? macd.histogram[macd.histogram.length - 1] : 'N/A';

    // Simple Recommendation Logic
    let recommendation = '관망';
    let reason = '지표를 분석 중입니다.';

    // Example Buy Signal: RSI below 30 (oversold) AND MACD crossing above signal line (recent trend up)
    if (latestRSI14 !== 'N/A' && latestMACDLine !== 'N/A' && latestSignalLine !== 'N/A') {
        if (latestRSI14 < 30 && latestMACDLine > latestSignalLine && macd.macdLine[macd.macdLine.length - 2] <= macd.signalLine[macd.signalLine.length - 2]) {
            recommendation = '매수 추천';
            reason = `RSI(14)가 ${latestRSI14.toFixed(2)}로 과매도 구간이며, MACD선이 시그널선을 상향 돌파했습니다.`;
        } else if (latestRSI14 > 70 && latestMACDLine < latestSignalLine && macd.macdLine[macd.macdLine.length - 2] >= macd.signalLine[macd.signalLine.length - 2]) {
            recommendation = '매도 추천';
            reason = `RSI(14)가 ${latestRSI14.toFixed(2)}로 과매수 구간이며, MACD선이 시그널선을 하향 돌파했습니다.`;
        } else if (latestPrice > latestSMA20) {
            recommendation = '유지 (상승 추세)';
            reason = `현재 가격이 SMA(20) 위에 있습니다.`;
        } else if (latestPrice < latestSMA20) {
            recommendation = '유지 (하락 추세)';
            reason = `현재 가격이 SMA(20) 아래에 있습니다.`;
        }
    }


    recommendedStocks.push({
        ticker: ticker,
        name: {
            'AAPL': 'Apple Inc.',
            'MSFT': 'Microsoft Corp.',
            'AMZN': 'Amazon.com Inc.',
            'GOOGL': 'Alphabet Inc. (Google)',
            'NVDA': 'NVIDIA Corp.'
        }[ticker] || ticker,
        latestPrice: latestPrice,
        sma20: latestSMA20,
        rsi14: latestRSI14,
        macdLine: latestMACDLine,
        signalLine: latestSignalLine,
        histogram: latestHistogram,
        recommendation: recommendation,
        reason: reason
    });
}

const stockListElement = document.getElementById('stock-list');
stockListElement.innerHTML = ''; // Clear existing content

recommendedStocks.forEach(stock => {
    const stockElement = document.createElement('stock-recommendation');
    stockElement.setAttribute('name', stock.name);
    stockElement.setAttribute('ticker', stock.ticker);
    stockElement.setAttribute('reason', stock.reason);
    stockElement.setAttribute('latest-price', stock.latestPrice.toFixed(2));
    stockElement.setAttribute('sma20', stock.sma20 !== 'N/A' ? stock.sma20.toFixed(2) : 'N/A');
    stockElement.setAttribute('rsi14', stock.rsi14 !== 'N/A' ? stock.rsi14.toFixed(2) : 'N/A');
    stockElement.setAttribute('macd-line', stock.macdLine !== 'N/A' ? stock.macdLine.toFixed(2) : 'N/A');
    stockElement.setAttribute('signal-line', stock.signalLine !== 'N/A' ? stock.signalLine.toFixed(2) : 'N/A');
    stockElement.setAttribute('histogram', stock.histogram !== 'N/A' ? stock.histogram.toFixed(2) : 'N/A');
    stockElement.setAttribute('recommendation', stock.recommendation);
    stockListElement.appendChild(stockElement);
});

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
