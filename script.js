// script.js - Untuk GitHub Pages

class ScraperApp {
    constructor() {
        this.apiUrl = localStorage.getItem('scraperApiUrl') || '';
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadConfig();
    }

    bindEvents() {
        document.getElementById('scrapingForm').addEventListener('submit', (e) => this.handleScrapingSubmit(e));
        document.getElementById('apiUrl').addEventListener('change', (e) => this.saveConfig());
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
    }

    async handleScrapingSubmit(e) {
        e.preventDefault();
        
        if (!this.apiUrl) {
            this.showError('Silakan setting API URL terlebih dahulu');
            return;
        }

        const url = document.getElementById('urlInput').value.trim();
        if (!url) {
            this.showError('Silakan masukkan URL');
            return;
        }

        const options = {
            extractTitle: document.querySelector('[name="extractTitle"]').checked,
            extractMeta: document.querySelector('[name="extractMeta"]').checked,
            extractLinks: document.querySelector('[name="extractLinks"]').checked
        };

        await this.startScraping(url, options);
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

    async callAppsScriptAPI(functionName, data) {
        if (!this.apiUrl) {
            throw new Error('API URL belum diatur');
        }

        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                function: functionName,
                data: data
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error);
        }

        return result;
    }

    handleScrapingSuccess(result) {
        if (result.success) {
            this.showResults(`
                <div class="result-item result-success">
                    <div class="result-title">✅ Scraping Berhasil!</div>
                    <div><strong>URL:</strong> ${result.data.url}</div>
                    <div><strong>Status:</strong> ${result.data.statusCode}</div>
                    <div><strong>Judul:</strong> ${result.data.title || 'Tidak ditemukan'}</div>
                    ${result.data.metaDescription ? `<div><strong>Meta Description:</strong> ${result.data.metaDescription}</div>` : ''}
                    <div><strong>Preview Teks:</strong> ${result.data.textPreview}</div>
                    ${result.data.links && result.data.links.length > 0 ? `
                        <div><strong>Link ditemukan:</strong> ${result.data.links.length}</div>
                        <div class="links-preview">
                            ${result.data.links.slice(0, 5).map(link => 
                                `<div class="link-item">• ${link.text || 'No text'} → ${link.url}</div>`
                            ).join('')}
                            ${result.data.links.length > 5 ? `<div>... dan ${result.data.links.length - 5} link lainnya</div>` : ''}
                        </div>
                    ` : ''}
                    <div class="result-meta">
                        Diproses pada: ${new Date(result.timestamp).toLocaleString()}
                    </div>
                </div>
            `);
        } else {
            this.showResults(`
                <div class="result-item result-error">
                    <div class="result-title">❌ Gagal Scraping</div>
                    <div><strong>Error:</strong> ${result.error}</div>
                </div>
            `);
        }
    }

    handleScrapingError(error) {
        this.showResults(`
            <div class="result-item result-error">
                <div class="result-title">❌ Terjadi Error</div>
                <div><strong>Detail:</strong> ${error.message || error}</div>
                <div class="result-meta">Periksa koneksi internet dan API URL</div>
            </div>
        `);
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
                <div>${message}</div>
            </div>
        `);
    }

    showNotification(message, type = 'info') {
        // Simple notification implementation
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#34a853' : '#4285f4'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 1000;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.scraperApp = new ScraperApp();
});