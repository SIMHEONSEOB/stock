// --- Global Variables ---
const ALPHA_VANTAGE_API_KEY = '1D4KMGHILXDEKMP4'; // Replace with your actual Alpha Vantage API Key
const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query';
let chartInstance = null; // To hold the Chart.js instance
let stockData = {}; // To store fetched stock data including prices and dates

// --- Helper Functions ---

/**
 * Introduces a delay.
 * @param {number} ms - Milliseconds to sleep.
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

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
    if (data.length < period + 1) return rsi; // Need at least period + 1 data points for the first change

    let gains = [];
    let losses = [];

    // Calculate initial gains and losses
    for (let i = 1; i < data.length; i++) {
        const change = data[i] - data[i - 1];
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? Math.abs(change) : 0);
    }

    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

    if (avgLoss === 0) { // Avoid division by zero
        rsi.push(100);
    } else {
        const rs = avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
    }

    for (let i = period; i < gains.length; i++) {
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

        if (avgLoss === 0) {
            rsi.push(100);
        } else {
            const rs = avgGain / avgLoss;
            rsi.push(100 - (100 / (1 + rs)));
        }
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
    // Initial SMA for the first EMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += data[i];
    }
    ema[period - 1] = sum / period;

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

    // Ensure EMAs are of the same length by trimming the longer one (slowEMA is generally shorter)
    const macdLine = [];
    const startIndex = slowEMA.length - fastEMA.length >= 0 ? slowEMA.length - fastEMA.length : 0;
    for (let i = startIndex; i < slowEMA.length; i++) {
        macdLine.push(fastEMA[i] - slowEMA[i]);
    }

    const signalLine = calculateEMA(macdLine, signalPeriod);

    const histogram = [];
    const minLength = Math.min(macdLine.length, signalLine.length);
    for (let i = 0; i < minLength; i++) {
        histogram.push(macdLine[macdLine.length - minLength + i] - signalLine[signalLine.length - minLength + i]);
    }

    return { macdLine, signalLine, histogram };
}

/**
 * Fetches news data for a given ticker.
 * @param {string} ticker - The stock ticker symbol.
 * @returns {Promise<Array<Object>>} - Array of news articles.
 */
async function fetchNewsData(ticker) {
    try {
        const url = `${ALPHA_VANTAGE_BASE_URL}?function=NEWS_SENTIMENT&tickers=${ticker}&limit=5&sort=latest&apikey=${ALPHA_VANTAGE_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data['Error Message'] || !data.feed || data.feed.length === 0) {
            console.error(`Error fetching news or no news found for ${ticker}`);
            return [];
        }
        return data.feed.slice(0, 5).map(item => ({
            title: item.title,
            url: item.url,
            source: item.source,
            time_published: item.time_published
        }));
    } catch (error) {
        console.error(`Failed to fetch news for ${ticker}:`, error);
        return [];
    }
}


// --- Main Data Fetching and UI Update Logic ---

async function fetchAndRenderStockData(ticker = 'AAPL') {
    try {
        // Show loading state if desired
        document.getElementById('stock-name').textContent = '데이터 로딩 중...';

        const url = `${ALPHA_VANTAGE_BASE_URL}?function=TIME_SERIES_DAILY&symbol=${ticker}&apikey=${ALPHA_VANTAGE_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data['Error Message'] || !data['Time Series (Daily)']) {
            console.error(`Error fetching data for ${ticker}:`, data['Error Message'] || 'No daily time series data');
            document.getElementById('stock-name').textContent = `데이터 로드 실패 (${ticker})`;
            return;
        }

        const timeSeries = data['Time Series (Daily)'];
        const dates = Object.keys(timeSeries).sort(); // Sort by date ascending

        if (dates.length === 0) {
            console.error(`No price data found for ${ticker}`);
            document.getElementById('stock-name').textContent = `데이터 없음 (${ticker})`;
            return;
        }

        const prices = dates.map(date => parseFloat(timeSeries[date]['4. close']));
        const volumes = dates.map(date => parseInt(timeSeries[date]['5. volume']));

        // Store for chart
        stockData.dates = dates;
        stockData.prices = prices;
        stockData.ticker = ticker;
        stockData.companyName = data['Meta Data']['2. Symbol'];

        const latestDate = dates[dates.length - 1];
        const previousDate = dates[dates.length - 2];
        const latestPrice = prices[prices.length - 1];
        const previousClosePrice = prices[prices.length - 2];
        const latestVolume = volumes[volumes.length - 1];

        const priceChange = latestPrice - previousClosePrice;
        const priceChangePercent = (priceChange / previousClosePrice) * 100;

        // Calculate Indicators
        const sma20Values = calculateSMA(prices, 20);
        const rsi14Values = calculateRSI(prices, 14);
        const macdResult = calculateMACD(prices, 12, 26, 9);

        const latestSMA20 = sma20Values.length > 0 ? sma20Values[sma20Values.length - 1] : NaN;
        const latestRSI14 = rsi14Values.length > 0 ? rsi14Values[rsi14Values.length - 1] : NaN;
        const latestMACDLine = macdResult.macdLine.length > 0 ? macdResult.macdLine[macdResult.macdLine.length - 1] : NaN;
        const latestSignalLine = macdResult.signalLine.length > 0 ? macdResult.signalLine[macdResult.signalLine.length - 1] : NaN;

        // Determine Recommendation and Status for display
        let recommendation = '관망';
        let aiReason = '지표를 분석 중입니다.';
        let rsiStatus = '확인';
        let macdStatus = '확인';
        let signalStatus = '확인'; // Although signal is a value, the UI has a 'status'

        if (!isNaN(latestRSI14)) {
            if (latestRSI14 < 30) {
                rsiStatus = '과매도';
                recommendation = '매수';
                aiReason = `RSI(14) ${latestRSI14.toFixed(2)}로 과매도 구간입니다.`;
            } else if (latestRSI14 > 70) {
                rsiStatus = '과매수';
                recommendation = '매도';
                aiReason = `RSI(14) ${latestRSI14.toFixed(2)}로 과매수 구간입니다.`;
            } else {
                rsiStatus = '중립';
            }
        }

        if (!isNaN(latestMACDLine) && !isNaN(latestSignalLine)) {
            if (latestMACDLine > latestSignalLine) {
                macdStatus = '강세';
                if (recommendation !== '매도') recommendation = '매수'; // Only override if not already a strong 'sell'
                aiReason = `MACD선이 시그널선 위에 있습니다. ${aiReason}`;
            } else if (latestMACDLine < latestSignalLine) {
                macdStatus = '약세';
                if (recommendation !== '매수') recommendation = '매도'; // Only override if not already a strong 'buy'
                aiReason = `MACD선이 시그널선 아래에 있습니다. ${aiReason}`;
            }
        }

        if (!isNaN(latestSMA20) && latestPrice > latestSMA20) {
            recommendation = '유지 (상승 추세)';
            aiReason = `현재 가격 ($${latestPrice.toFixed(2)})이 SMA(20) ($${latestSMA20.toFixed(2)}) 위에 있습니다.`;
        } else if (!isNaN(latestSMA20) && latestPrice < latestSMA20) {
            recommendation = '유지 (하락 추세)';
            aiReason = `현재 가격 ($${latestPrice.toFixed(2)})이 SMA(20) ($${latestSMA20.toFixed(2)}) 아래에 있습니다.`;
        }


        // Update UI Elements
        document.getElementById('stock-name').textContent = stockData.companyName;
        document.getElementById('stock-ticker').textContent = ticker;
        document.getElementById('price-value').textContent = `$${latestPrice.toFixed(2)}`;
        
        const priceChangeElement = document.getElementById('price-change-value');
        priceChangeElement.textContent = `${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)} (${priceChangePercent.toFixed(2)}%)`;
        priceChangeElement.className = `data-value ${priceChange > 0 ? 'positive' : 'negative'}`;

        document.getElementById('volume-value').textContent = `${(latestVolume / 1000000).toFixed(2)}M`;
        // Market Cap is not provided by Alpha Vantage daily series, using a placeholder
        document.getElementById('market-cap-value').textContent = '$TBD'; // Placeholder

        document.getElementById('price-date').textContent = `${latestDate} 기준`; // Assuming date format YYYY-MM-DD

        document.getElementById('rec-value-tag').textContent = recommendation.split(' ')[0]; // Just the first word
        document.getElementById('ai-reason').textContent = aiReason;

        document.getElementById('rsi-value').textContent = isNaN(latestRSI14) ? 'N/A' : latestRSI14.toFixed(2);
        document.getElementById('rsi-status').textContent = rsiStatus;
        document.getElementById('rsi-status').className = `indicator-status ${rsiStatus === '과매도' || rsiStatus === '과매수' ? 'red' : 'green'}`;

        document.getElementById('macd-value').textContent = isNaN(latestMACDLine) ? 'N/A' : latestMACDLine.toFixed(2);
        document.getElementById('macd-status').textContent = macdStatus;
        document.getElementById('macd-status').className = `indicator-status ${macdStatus === '강세' ? 'green' : (macdStatus === '약세' ? 'red' : 'gray')}`;

        document.getElementById('signal-value').textContent = isNaN(latestSignalLine) ? 'N/A' : latestSignalLine.toFixed(2);
        document.getElementById('signal-status').textContent = signalStatus;
        document.getElementById('signal-status').className = `indicator-status ${signalStatus === '확인' ? 'gray' : ''}`; // No strong color for signal line status

    } catch (error) {
        console.error('Error in fetchAndRenderStockData:', error);
        document.getElementById('stock-name').textContent = `데이터 로드 오류 (${ticker})`;
    }
}


// --- Chart Rendering ---

function renderChartModal() {
    const modal = document.getElementById('chart-modal');
    const ctx = document.getElementById('stock-chart').getContext('2d');

    if (chartInstance) {
        chartInstance.destroy(); // Destroy previous chart instance if exists
    }

    if (!stockData.prices || stockData.prices.length === 0 || !stockData.dates || stockData.dates.length === 0) {
        console.warn('No stock data available for chart rendering.');
        // Optionally display a message in the modal
        return;
    }

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: stockData.dates.slice(-60), // Show last 60 days
            datasets: [{
                label: `${stockData.companyName} (${stockData.ticker}) 종가`,
                data: stockData.prices.slice(-60),
                borderColor: 'rgb(0, 82, 255)',
                backgroundColor: 'rgba(0, 82, 255, 0.1)',
                borderWidth: 2,
                pointRadius: 0, // No points for cleaner line
                fill: true,
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            font: { // Global font settings for the chart
                family: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
            },
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: '#1a1a1a', // Matching body text color
                        font: {
                            size: 14
                        }
                    }
                },
                title: {
                    display: true,
                    text: `${stockData.companyName} (${stockData.ticker}) 주가 변동`,
                    color: '#1a1a1a', // Matching body text color
                    font: {
                        size: 18,
                        weight: 'bold'
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#5e5e5e', // Matching secondary text color
                        font: {
                            size: 12
                        }
                    },
                    title: {
                        display: true,
                        text: '날짜',
                        color: '#1a1a1a', // Matching body text color
                        font: {
                            size: 14
                        }
                    }
                },
                y: {
                    grid: { color: '#eef0f4' }, // Light grid lines
                    ticks: {
                        color: '#5e5e5e', // Matching secondary text color
                        font: {
                            size: 12
                        }
                    },
                    title: {
                        display: true,
                        text: '가격 (USD)',
                        color: '#1a1a1a', // Matching body text color
                        font: {
                            size: 14
                        }
                    }
                }
            }
        }
    });

    document.getElementById('modal-ticker').textContent = stockData.ticker;
    modal.style.display = 'flex'; // Use flex to center
}


// --- News Rendering ---

async function renderNewsModal() {
    const modal = document.getElementById('news-modal');
    const newsContentDiv = document.getElementById('news-content');
    newsContentDiv.innerHTML = '<p>뉴스를 불러오는 중...</p>'; // Loading state

    try {
        const articles = await fetchNewsData(stockData.ticker || 'AAPL');
        if (articles.length === 0) {
            newsContentDiv.innerHTML = '<p>관련 뉴스를 찾을 수 없습니다.</p>';
        } else {
            const newsHtml = articles.map(article => `
                <div class="news-item">
                    <a href="${article.url}" target="_blank">${article.title}</a>
                    <span class="news-meta">${article.source} - ${new Date(article.time_published).toLocaleDateString()}</span>
                </div>
            `).join('');
            newsContentDiv.innerHTML = newsHtml;
        }
    } catch (error) {
        console.error('Error fetching news for modal:', error);
        newsContentDiv.innerHTML = '<p>뉴스 로드 중 오류가 발생했습니다.</p>';
    }

    document.getElementById('modal-news-ticker').textContent = stockData.ticker || 'AAPL';
    modal.style.display = 'flex';
}


// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    fetchAndRenderStockData(); // Initial load for AAPL

    // Chart Modal Logic
    const chartActionBtn = document.getElementById('chart-action-btn');
    const chartModal = document.getElementById('chart-modal');
    const chartCloseBtn = chartModal.querySelector('.close-button');

    chartActionBtn.addEventListener('click', () => {
        if (stockData.prices && stockData.dates) {
            renderChartModal();
        } else {
            alert('차트 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
        }
    });
    chartCloseBtn.addEventListener('click', () => {
        chartModal.style.display = 'none';
    });
    window.addEventListener('click', (event) => {
        if (event.target == chartModal) {
            chartModal.style.display = 'none';
        }
    });

    // News Modal Logic
    const newsActionBtn = document.getElementById('news-action-btn');
    const newsModal = document.getElementById('news-modal');
    const newsCloseBtn = newsModal.querySelector('.close-button');

    newsActionBtn.addEventListener('click', () => {
        renderNewsModal();
    });
    newsCloseBtn.addEventListener('click', () => {
        newsModal.style.display = 'none';
    });
    window.addEventListener('click', (event) => {
        if (event.target == newsModal) {
            newsModal.style.display = 'none';
        }
    });
});