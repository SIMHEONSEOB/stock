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

        const ohlcData = dates.map(date => ({
            time: date,
            open: parseFloat(timeSeries[date]['1. open']),
            high: parseFloat(timeSeries[date]['2. high']),
            low: parseFloat(timeSeries[date]['3. low']),
            close: parseFloat(timeSeries[date]['4. close']),
        }));
        const prices = dates.map(date => parseFloat(timeSeries[date]['4. close'])); // For indicator calculations
        const volumes = dates.map(date => parseInt(timeSeries[date]['5. volume']));

        // Store for chart
        stockData.ohlcData = ohlcData; // Store OHLC data for Lightweight Charts
        stockData.dates = dates;
        stockData.prices = prices; // Keep prices array for indicator calculations
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

        // Update price change indicator color
        const priceChangeIndicator = document.getElementById('price-change-indicator');
        priceChangeIndicator.style.backgroundColor = priceChange > 0 ? '#2eb85c' : '#ff4d4f'; // Green for positive, Red for negative


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

let chart = null; // Lightweight Charts instance

const displayStockChart = async () => {
    const chartContainer = document.getElementById('chart-container');
    chartContainer.innerHTML = ''; // Clear previous chart if any

    if (!stockData.ohlcData || stockData.ohlcData.length === 0) {
        console.warn('No OHLC data available for chart rendering.');
        chartContainer.innerHTML = '<p style="color: #c9d1d9; text-align: center; padding-top: 50px;">차트 데이터를 불러올 수 없습니다.</p>';
        return;
    }

    // Initialize the chart
    chart = LightweightCharts.createChart(chartContainer, {
        layout: {
            background: { color: '#111827' },
            textColor: 'rgba(255, 255, 255, 0.9)',
            fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
        },
        grid: {
            vertLines: { color: '#334155' },
            horzLines: { color: '#334155' },
        },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        rightPriceScale: {
            borderColor: '#485c7b',
            scaleMargins: {
                top: 0.1,
                bottom: 0.25,
            },
        },
        timeScale: {
            borderColor: '#485c7b',
            timeVisible: true,
            secondsVisible: false,
            // Adjusting font of time scale
            barSpacing: 10, // Default is 6, wider bars
            rightOffset: 12, // Offset from the right of the chart
            minBarSpacing: 5,
            tickMarkFormatter: (time) => {
                const date = new Date(time * 1000); // Lightweight Charts uses Unix timestamp in seconds
                return date.toLocaleDateString('ko-KR'); // Format date as desired
            },
        },
    });

    // Add candlestick series
    const candleSeries = chart.addCandlestickSeries({
        upColor: '#3b82f6',     // 상승: 파란색
        downColor: '#ef4444',   // 하락: 빨간색
        borderDownColor: '#ef4444',
        borderUpColor: '#3b82f6',
        wickDownColor: '#ef4444',
        wickUpColor: '#3b82f6',
    });

    // Set data for the series, using the last 60 days
    candleSeries.setData(stockData.ohlcData.slice(-60).map(d => ({
        time: Math.floor(new Date(d.time).getTime() / 1000), // Convert date string to Unix timestamp in seconds
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
    })));

    // Fit chart to data
    chart.timeScale().fitContent();

    // Set title dynamically
    chart.applyOptions({
        watermark: {
            visible: true,
            fontSize: 24,
            horzAlign: 'left',
            vertAlign: 'top',
            color: 'rgba(255, 255, 255, 0.5)',
            text: `${stockData.companyName} (${stockData.ticker})`,
        },
    });

};


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
    modal.classList.add('show');
}


// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    fetchAndRenderStockData(); // Initial load for AAPL

    // Chart Modal Logic
    const chartActionBtn = document.getElementById('chart-action-btn');
    const chartModal = document.getElementById('chart-modal');
    const chartCloseBtn = document.getElementById('chart-close-button'); // Use specific ID for chart close button

    chartActionBtn.addEventListener('click', () => {
        if (stockData.ohlcData && stockData.ohlcData.length > 0) {
            chartModal.classList.add('show');
            // Ensure chart renders after modal is visible
            requestAnimationFrame(() => {
                displayStockChart();
            });
        } else {
            alert('차트 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
        }
    });
    chartCloseBtn.addEventListener('click', () => {
        chartModal.classList.remove('show');
        if (chart) {
            chart.remove(); // Dispose chart instance
            chart = null;
        }
    });
    window.addEventListener('click', (event) => {
        if (event.target == chartModal) {
            chartModal.classList.remove('show');
            if (chart) {
                chart.remove();
                chart = null;
            }
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
        newsModal.classList.remove('show');
    });
    window.addEventListener('click', (event) => {
        if (event.target == newsModal) {
            newsModal.classList.remove('show');
        }
    });
});