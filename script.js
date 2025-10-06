// script.js - Gunakan JSONP untuk bypass CORS

class ScraperApp {
    constructor() {
        this.apiUrl = localStorage.getItem('scraperApiUrl') || '';
        this.jsonpCallbackId = 0;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadConfig();
        if (this.apiUrl) {
            this.testConnection();
        }
    }

    bindEvents() {
        document.getElementById('scrapingForm').addEventListener('submit', (e) => this.handleScrapingSubmit(e));
        document.getElementById('apiUrl').addEventListener('change', (e) => this.saveConfig());
        
        document.getElementById('urlInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleScrapingSubmit(e);
            }
        });
    }

    loadConfig() {
        const apiUrlInput = document.getElementById('apiUrl');
        if (this.apiUrl) {
            apiUrlInput.value = this.apiUrl;
        }
    }

    saveConfig() {
        const apiUrlInput = document.getElementById('apiUrl');
        this.apiUrl = apiUrlInput.value.trim();
        localStorage.setItem('scraperApiUrl', this.apiUrl);
        this.showNotification('Konfigurasi disimpan!', 'success');
        this.testConnection();
    }

    async testConnection() {
        if (!this.apiUrl) return;
        
        try {
            const response = await this.callAppsScriptAPI('testConnection', {});
            if (response.success) {
                this.showNotification('✅ Koneksi API berhasil!', 'success');
            }
        } catch (error) {
            console.log('Connection test failed:', error);
            this.showNotification('❌ Koneksi API gagal', 'error');
        }
    }

    async handleScrapingSubmit(e) {
        e.preventDefault();
        
        if (!this.apiUrl) {
            this.showError('Silakan setting API URL terlebih dahulu di bagian Konfigurasi API');
            return;
        }

        const url = document.getElementById('urlInput').value.trim();
        if (!url) {
            this.showError('Silakan masukkan URL website yang ingin di-scrape');
            return;
        }

        if (!this.isValidUrl(url)) {
            this.showError('Format URL tidak valid. Pastikan URL dimulai dengan http:// atau https://');
            return;
        }

        const options = {
            extractTitle: document.querySelector('[name="extractTitle"]').checked,
            extractMeta: document.querySelector('[name="extractMeta"]').checked,
            extractLinks: document.querySelector('[name="extractLinks"]').checked
        };

        await this.startScraping(url, options);
    }

    isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (_) {
            return false;
        }
    }

    async startScraping(url, options) {
        this.setLoading(true);
        this.hideResults();

        try {
            const response = await this.callAppsScriptAPI('scrapeAndSave', { url, options });
            this.handleScrapingSuccess(response);
        } catch (error) {
            this.handleScrapingError(error);
        } finally {
            this.setLoading(false);
        }
    }

    callAppsScriptAPI(functionName, data) {
        return new Promise((resolve, reject) => {
            if (!this.apiUrl) {
                reject(new Error('API URL belum diatur'));
                return;
            }

            console.log('Calling API:', functionName, data);

            // Build URL dengan parameters
            const url = new URL(this.apiUrl);
            url.searchParams.set('function', functionName);
            
            // Add data parameters
            Object.keys(data).forEach(key => {
                if (typeof data[key] === 'object') {
                    url.searchParams.set(key, JSON.stringify(data[key]));
                } else {
                    url.searchParams.set(key, data[key]);
                }
            });

            // Add timestamp untuk avoid cache
            url.searchParams.set('_t', Date.now());

            console.log('Final URL:', url.toString());

            // Coba fetch biasa dulu
            fetch(url.toString())
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(result => {
                    if (result.error) {
                        throw new Error(result.error);
                    }
                    resolve(result);
                })
                .catch(fetchError => {
                    console.log('Fetch failed, trying JSONP:', fetchError);
                    // Jika fetch gagal, coba JSONP
                    this.callAppsScriptAPI_JSONP(functionName, data, resolve, reject);
                });
        });
    }

    callAppsScriptAPI_JSONP(functionName, data, resolve, reject) {
        const callbackName = `jsonp_callback_${this.jsonpCallbackId++}`;
        const timeoutId = setTimeout(() => {
            reject(new Error('JSONP timeout'));
            delete window[callbackName];
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
        }, 30000);

        // Build URL dengan callback parameter
        const url = new URL(this.apiUrl);
        url.searchParams.set('function', functionName);
        url.searchParams.set('callback', callbackName);
        
        Object.keys(data).forEach(key => {
            if (typeof data[key] === 'object') {
                url.searchParams.set(key, JSON.stringify(data[key]));
            } else {
                url.searchParams.set(key, data[key]);
            }
        });

        window[callbackName] = (response) => {
            clearTimeout(timeoutId);
            delete window[callbackName];
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
            
            if (response.error) {
                reject(new Error(response.error));
            } else {
                resolve(response);
            }
        };

        const script = document.createElement('script');
        script.src = url.toString();
        script.onerror = () => {
            clearTimeout(timeoutId);
            delete window[callbackName];
            reject(new Error('JSONP script failed to load'));
        };
        
        document.head.appendChild(script);
    }

    handleScrapingSuccess(result) {
        if (result.success) {
            this.showResults(`
                <div class="result-item result-success">
                    <div class="result-title">✅ Scraping Berhasil!</div>
                    <div><strong>URL:</strong> ${result.data.url}</div>
                    <div><strong>Status HTTP:</strong> ${result.data.statusCode}</div>
                    <div><strong>Judul:</strong> ${result.data.title || 'Tidak ditemukan'}</div>
                    ${result.data.metaDescription ? `<div><strong>Meta Description:</strong> ${result.data.metaDescription}</div>` : ''}
                    <div><strong>Preview Teks:</strong> ${result.data.textPreview}</div>
                    ${result.data.links && result.data.links.length > 0 ? `
                        <div><strong>Link ditemukan:</strong> ${result.data.links.length}</div>
                        <div class="links-preview">
                            ${result.data.links.slice(0, 3).map(link => 
                                `<div class="link-item">• ${this.escapeHtml(link.text || 'No text')} → ${this.escapeHtml(link.url)}</div>`
                            ).join('')}
                            ${result.data.links.length > 3 ? `<div><em>... dan ${result.data.links.length - 3} link lainnya</em></div>` : ''}
                        </div>
                    ` : ''}
                    <div class="result-meta">
                        Diproses pada: ${new Date(result.timestamp).toLocaleString('id-ID')}
                    </div>
                </div>
            `);
            
            // Clear form setelah success
            document.getElementById('urlInput').value = '';
        } else {
            this.showResults(`
                <div class="result-item result-error">
                    <div class="result-title">❌ Gagal Scraping</div>
                    <div><strong>Error:</strong> ${this.escapeHtml(result.error)}</div>
                </div>
            `);
        }
    }

    handleScrapingError(error) {
        console.error('Scraping error:', error);
        
        let errorMessage = error.message || error.toString();
        
        this.showResults(`
            <div class="result-item result-error">
                <div class="result-title">❌ Terjadi Error</div>
                <div><strong>Detail:</strong> ${this.escapeHtml(errorMessage)}</div>
                <div class="result-meta">
                    <strong>Troubleshooting:</strong><br>
                    • Pastikan URL Apps Script benar<br>
                    • Deploy sebagai Web App dengan akses "Anyone"<br>
                    • Ganti Spreadsheet ID di kode Apps Script
                </div>
            </div>
        `);
    }

    escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return unsafe;
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    setLoading(loading) {
        const button = document.getElementById('scrapeButton');
        const buttonText = button.querySelector('.button-text');
        const spinner = button.querySelector('.spinner');

        if (loading) {
            buttonText.textContent = 'Scraping...';
            spinner.style.display = 'block';
            button.disabled = true;
        } else {
            buttonText.textContent = 'Mulai Scraping';
            spinner.style.display = 'none';
            button.disabled = false;
        }
    }

    showResults(html) {
        const resultsContent = document.getElementById('resultsContent');
        const resultsCard = document.getElementById('resultsCard');
        
        resultsContent.innerHTML = html;
        resultsCard.style.display = 'block';
        resultsCard.scrollIntoView({ behavior: 'smooth' });
    }

    hideResults() {
        document.getElementById('resultsCard').style.display = 'none';
    }

    showError(message) {
        this.showResults(`
            <div class="result-item result-error">
                <div class="result-title">❌ Error</div>
                <div>${this.escapeHtml(message)}</div>
            </div>
        `);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#34a853' : type === 'error' ? '#ea4335' : '#4285f4'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 1000;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 4000);
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    window.scraperApp = new ScraperApp();
});
