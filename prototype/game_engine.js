/**
 * game_engine.js — Core game logic for the photosphere guessing game.
 *
 * Responsibilities:
 *   - State machine (LOADING → PROMPTING → CHECKING → CORRECT/INCORRECT/OUT_OF_GUESSES)
 *   - Zone proximity checking (angular distance on sphere)
 *   - Guess counting
 *   - Score persistence (localStorage)
 *   - Click coordinate capture (desktop: mouseEventToCoords, mobile: viewport center)
 *
 * Depends on: Pannellum viewer instance, i18n.js (LANG), game_viewer.html (DOM IDs)
 *
 * Usage:
 *   const game = new GameEngine(viewer, gameData);
 *   game.start();
 */

(function(global) {
'use strict';

// ── Utility: angular distance (degrees → radians → haversine) ────────────
function angularDistance(p1, y1, p2, y2) {
    const toRad = Math.PI / 180;
    const sp1 = Math.sin(p1 * toRad), cp1 = Math.cos(p1 * toRad);
    const sp2 = Math.sin(p2 * toRad), cp2 = Math.cos(p2 * toRad);
    const dYaw = (y2 - y1) * toRad;
    // Clamp to [-1, 1] to avoid NaN from floating-point rounding
    const cosDist = Math.max(-1, Math.min(1, sp1 * sp2 + cp1 * cp2 * Math.cos(dYaw)));
    const delta = Math.acos(cosDist);
    return delta / toRad; // back to degrees
}

// ── Utility: escape HTML ─────────────────────────────────────────────────
function escapeHTML(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// ── GameEngine class ─────────────────────────────────────────────────────

global.GameEngine = class GameEngine {
    /**
     * @param {object} viewer - Pannellum viewer instance
     * @param {object} gameData - Parsed game JSON (with .game namespace)
     * @param {object} dom - references to key DOM elements
     * @param {string} pageId - wiki page identifier for score storage
     */
    constructor(viewer, gameData, dom, pageId) {
        this.viewer = viewer;
        this.data = gameData;
        this.dom = dom;             // { panorama, promptBanner, promptText, guessDots, hintBtn,
                                    //   mobileCrosshair, guessBtn, scoreCard, scoreTitle, scoreMsg,
                                    //   scoreStars, scoreLink, playAgainBtn, clickMarker }
        this.pageId = pageId;       // e.g. "User:Quizmaster/Museum_Mysteries"

        // Game config from JSON
        const g = gameData.game || {};
        this.prompt = g.prompt || '';
        this.maxGuesses = g.maxGuesses || 3;
        this.freeUnzonedClicks = g.freeUnzonedClicks === true;
        this.showDecoyMessages = g.showDecoyMessages !== false;
        this.hint = g.hint || null;
        this.hintAfterGuesses = g.hintAfterGuesses || 1;
        this.sceneId = g.sceneId || (gameData.default && gameData.default.firstScene) || '';
        this.initialView = g.initialView || { pitch: 0, yaw: 0, hfov: 100 };
        this.answer = g.answer || null;
        this.decoys = g.decoys || [];

        // State
        this.state = 'loading';     // loading | prompting | checking | correct | incorrect | out_of_guesses
        this.guessesUsed = 0;
        this.guessHistory = [];     // [{pitch, yaw, screenX, screenY, zone}] for markers
        this.hintRevealed = false;
        this._mobileMode = false;
        this._lockout = false;      // prevent clicks during animation
    }

    // ── Device detection ─────────────────────────────────────────────────
    detectMobile() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    // ── Startup ───────────────────────────────────────────────────────────
    start() {
        this._mobileMode = this.detectMobile();
        this.state = 'prompting';
        this._renderPrompt();
        this._renderGuessDots();
        this._setupMobileMode();
        this._attachClickHandler();

        // Set initial view
        if (this.viewer && this.initialView) {
            this.viewer.lookAt(this.initialView.pitch || 0,
                               this.initialView.yaw || 0,
                               this.initialView.hfov || 100);
        }
    }

    // ── Prompt banner ────────────────────────────────────────────────────
    _renderPrompt() {
        if (this.dom.promptText) {
            this.dom.promptText.textContent = this.prompt;
        }
        if (this.dom.promptBanner) {
            this.dom.promptBanner.style.display = 'flex';
        }
        // Hint button
        if (this.dom.hintBtn) {
            if (this.hint) {
                this.dom.hintBtn.style.display = 'inline-block';
                this.dom.hintBtn.onclick = () => this._revealHint();
            } else {
                this.dom.hintBtn.style.display = 'none';
            }
        }
    }

    _revealHint() {
        if (this.hintRevealed) return;
        this.hintRevealed = true;
        if (this.dom.hintBtn) {
            this.dom.hintBtn.textContent = '💡 ' + this.hint;
            this.dom.hintBtn.style.pointerEvents = 'none';
            this.dom.hintBtn.style.opacity = '0.8';
        }
    }

    // ── Guess dots ───────────────────────────────────────────────────────
    _renderGuessDots() {
        if (!this.dom.guessDots) return;
        let html = '';
        for (let i = 0; i < this.maxGuesses; i++) {
            html += '<span class="guess-dot"></span>';
        }
        this.dom.guessDots.innerHTML = html;
        this.dom.guessDots.title = LANG.guessesRemaining(this.maxGuesses);
    }

    _updateGuessDots() {
        if (!this.dom.guessDots) return;
        const dots = this.dom.guessDots.querySelectorAll('.guess-dot');
        for (let i = 0; i < dots.length; i++) {
            if (i < this.guessesUsed) {
                dots[i].classList.add('used');
            }
        }
        const remaining = this.maxGuesses - this.guessesUsed;
        this.dom.guessDots.title = LANG.guessesRemaining(remaining);
    }

    // ── Mobile mode ──────────────────────────────────────────────────────
    _setupMobileMode() {
        if (!this._mobileMode) return;

        // Show crosshair + guess button
        if (this.dom.mobileCrosshair) this.dom.mobileCrosshair.style.display = 'block';
        if (this.dom.guessBtn) {
            this.dom.guessBtn.style.display = 'block';
            this.dom.guessBtn.textContent = LANG.guessHere;
            this.dom.guessBtn.onclick = () => this._handleMobileGuess();
        }
        if (this.dom.mobileHintText) {
            this.dom.mobileHintText.textContent = LANG.mobileHint;
            this.dom.mobileHintText.style.display = 'block';
        }

        // On desktop, also hide the crosshair
    }

    // ── Click handling ───────────────────────────────────────────────────
    _attachClickHandler() {
        if (!this.viewer) return;

        if (this._mobileMode) {
            // On mobile, clicks on the panorama do NOT count as guesses.
            // The user must use the Guess Here button.
            return;
        }

        // Desktop: only count as guess if mouse didn't move (click vs drag).
        // Compare mousedown position to mouseup position — if the mouse moved
        // more than a few pixels, it was a drag/pan, not a click.
        const DRAG_THRESHOLD = 4; // pixels
        let downX = 0, downY = 0;
        let downEvent = null;

        this.viewer.on('mousedown', (e) => {
            downX = e.clientX;
            downY = e.clientY;
            downEvent = e;
        });

        this.viewer.on('mouseup', (e) => {
            if (this.state !== 'prompting' || this._lockout) {
                downEvent = null;
                return;
            }
            const dx = e.clientX - downX;
            const dy = e.clientY - downY;
            const moved = Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD;
            if (!moved && downEvent) {
                this._processGuess(downEvent);
            }
            downEvent = null;
        });
    }

    _handleMobileGuess() {
        if (this.state !== 'prompting' || this._lockout) return;

        // Get current viewport center as guess
        const pitch = this.viewer.getPitch();
        const yaw = this.viewer.getYaw();

        // Get screen center for marker placement
        const rect = this.dom.panorama.getBoundingClientRect();
        const screenX = rect.left + rect.width / 2;
        const screenY = rect.top + rect.height / 2;

        this._processGuess({ clientX: screenX, clientY: screenY, pitch, yaw, isMobile: true });
    }

    _processGuess(event) {
        // Convert screen coords to sphere coords if not already done
        let pitch, yaw;
        if (event.isMobile) {
            pitch = event.pitch;
            yaw = event.yaw;
        } else {
            const coords = this.viewer.mouseEventToCoords(event);
            if (!coords) return; // click missed the sphere
            pitch = coords[0];
            yaw = coords[1];
        }

        // Get screen position for marker
        const rect = this.dom.panorama.getBoundingClientRect();
        const screenX = event.clientX - rect.left;
        const screenY = event.clientY - rect.top;

        // Check zones
        const result = this._checkZones(pitch, yaw);

        // Handle free unzoned clicks (don't count as guess)
        if (result.zone === 'none' && this.freeUnzonedClicks) {
            this._showClickMarker(screenX, screenY, 'free');
            return;
        }

        this.guessesUsed++;
        this.guessHistory.push({ pitch, yaw, screenX, screenY, zone: result.zone });
        this._updateGuessDots();
        this._showClickMarker(screenX, screenY, result.zone === 'answer' ? 'correct' : 'incorrect');

        // Auto-reveal hint after threshold
        if (this.hint && !this.hintRevealed && this.guessesUsed >= this.hintAfterGuesses) {
            this._revealHint();
        }

        if (result.zone === 'answer') {
            this._onCorrect(result.message);
        } else {
            this._onIncorrect(result.zone === 'decoy' ? result.message : null);
        }
    }

    // ── Zone checking ────────────────────────────────────────────────────
    _checkZones(pitch, yaw) {
        // Check answer zone first
        if (this.answer) {
            const dist = angularDistance(pitch, yaw, this.answer.pitch, this.answer.yaw);
            if (dist <= (this.answer.radius || 8)) {
                return {
                    zone: 'answer',
                    message: this.answer.successMessage || '',
                    title: this.answer.successTitle || LANG.correctDefaultTitle,
                    link: this.answer.successLink || null,
                    image: this.answer.successImage || null,
                    label: this.answer.label || ''
                };
            }
        }

        // Check decoy zones
        for (const decoy of this.decoys) {
            const dist = angularDistance(pitch, yaw, decoy.pitch, decoy.yaw);
            if (dist <= (decoy.radius || 8)) {
                return {
                    zone: 'decoy',
                    message: this.showDecoyMessages ? (decoy.message || '') : '',
                    label: decoy.label || ''
                };
            }
        }

        // No zone matched
        return { zone: 'none', message: '' };
    }

    // ── Visual feedback ──────────────────────────────────────────────────
    _showClickMarker(x, y, type) {
        if (!this.dom.clickMarkers) return;

        const marker = document.createElement('div');
        marker.className = 'click-marker marker-' + type;
        marker.style.left = x + 'px';
        marker.style.top = y + 'px';

        if (type === 'correct') {
            marker.textContent = '✓';
        } else if (type === 'incorrect') {
            marker.textContent = '✗';
        } else {
            marker.textContent = '·'; // free click (small dot)
        }

        this.dom.clickMarkers.appendChild(marker);

        // Animate and remove
        requestAnimationFrame(() => marker.classList.add('visible'));
        const delay = type === 'free' ? 1500 : 3000;
        setTimeout(() => {
            marker.classList.remove('visible');
            setTimeout(() => marker.remove(), 400);
        }, delay);
    }

    _showClickTooltip(x, y, message) {
        if (!message) return;
        if (!this.dom.clickMarkers) return;

        const tip = document.createElement('div');
        tip.className = 'click-tooltip';
        tip.style.left = (x + 20) + 'px';
        tip.style.top = (y - 10) + 'px';
        tip.textContent = message;
        this.dom.clickMarkers.appendChild(tip);

        requestAnimationFrame(() => tip.classList.add('visible'));
        setTimeout(() => {
            tip.classList.remove('visible');
            setTimeout(() => tip.remove(), 400);
        }, 3000);
    }

    // ── Game outcomes ────────────────────────────────────────────────────
    _onCorrect(resultMessage) {
        this._lockout = true;
        this.state = 'correct';
        this._saveScore(this._scoreFromGuesses(this.guessesUsed));
        this._showScoreCard('correct', resultMessage);
    }

    _onIncorrect(decoyMessage) {
        // Show decoy message as tooltip near last click marker
        if (decoyMessage && this.dom.clickMarkers) {
            const lastMarker = this.dom.clickMarkers.lastElementChild;
            if (lastMarker) {
                const x = parseFloat(lastMarker.style.left) || 0;
                const y = parseFloat(lastMarker.style.top) || 0;
                this._showClickTooltip(x, y, decoyMessage);
            }
        }

        if (this.guessesUsed >= this.maxGuesses) {
            this._lockout = true;
            this.state = 'out_of_guesses';
            this._saveScore(0);
            this._showScoreCard('failed');
        }
    }

    // ── Score persistence ────────────────────────────────────────────────
    _scoreFromGuesses(used) {
        if (used === 1) return 3;
        if (used === 2) return 2;
        if (used === 3) return 1;
        return 0;
    }

    _saveScore(score) {
        try {
            const stored = JSON.parse(localStorage.getItem('wikisphere_scores') || '{}');
            stored[this.pageId] = {
                score: score,
                maxScore: 3,
                guessesUsed: this.guessesUsed,
                completedAt: new Date().toISOString(),
                title: (this.data.game && this.data.game.title) || this.pageId
            };
            localStorage.setItem('wikisphere_scores', JSON.stringify(stored));
        } catch (e) {
            console.warn('Failed to save score:', e);
        }
    }

    // ── Score card UI ────────────────────────────────────────────────────
    _showScoreCard(result, messageOverride) {
        if (!this.dom.scoreCard) return;
        this.dom.scoreCard.style.display = 'flex';

        const isCorrect = result === 'correct';
        const score = isCorrect ? this._scoreFromGuesses(this.guessesUsed) : 0;

        // Title
        if (isCorrect) {
            const answerTitle = (this.answer && this.answer.successTitle) || LANG.correctDefaultTitle;
            this.dom.scoreTitle.textContent = answerTitle;
        } else {
            this.dom.scoreTitle.textContent = LANG.outOfGuesses;
        }

        // Message
        if (isCorrect) {
            this.dom.scoreMsg.textContent = messageOverride || (this.answer && this.answer.successMessage) || '';
            // Show answer for failed
            this.dom.scoreAnswer.style.display = 'none';
        } else {
            this.dom.scoreMsg.textContent = '';
            this.dom.scoreAnswer.style.display = 'block';
            this.dom.scoreAnswer.textContent = LANG.answerWas + ' ' +
                ((this.answer && this.answer.successMessage) || '');
        }

        // Stars
        let stars = '';
        for (let i = 0; i < 3; i++) {
            stars += i < score ? '★' : '☆';
        }
        if (this.dom.scoreStars) {
            this.dom.scoreStars.textContent = stars;
        }

        // Score subtitle
        if (this.dom.scoreSubtitle) {
            if (isCorrect) {
                if (this.guessesUsed === 1) this.dom.scoreSubtitle.textContent = LANG.scoreFirstTry;
                else if (this.guessesUsed === 2) this.dom.scoreSubtitle.textContent = LANG.scoreSecondTry;
                else this.dom.scoreSubtitle.textContent = LANG.scoreThirdTry;
            } else {
                this.dom.scoreSubtitle.textContent = LANG.scoreFailed;
            }
        }

        // Learn more link
        if (this.dom.scoreLink && this.answer && this.answer.successLink) {
            this.dom.scoreLink.href = this.answer.successLink;
            this.dom.scoreLink.style.display = 'inline-block';
        } else if (this.dom.scoreLink) {
            this.dom.scoreLink.style.display = 'none';
        }

        // Play again
        if (this.dom.playAgainBtn) {
            this.dom.playAgainBtn.onclick = () => this._reset();
        }
    }

    // ── Reset ────────────────────────────────────────────────────────────
    _reset() {
        this._lockout = false;
        this.state = 'prompting';
        this.guessesUsed = 0;
        this.guessHistory = [];
        this.hintRevealed = false;

        // Clear markers
        if (this.dom.clickMarkers) this.dom.clickMarkers.innerHTML = '';

        // Hide score card
        if (this.dom.scoreCard) this.dom.scoreCard.style.display = 'none';

        // Reset guess dots
        this._renderGuessDots();

        // Reset hint button
        if (this.dom.hintBtn && this.hint) {
            this.dom.hintBtn.textContent = LANG.hintButton;
            this.dom.hintBtn.style.pointerEvents = 'auto';
            this.dom.hintBtn.style.opacity = '1';
        }

        // Reset mobile hint text
        if (this.dom.mobileHintText) {
            this.dom.mobileHintText.textContent = LANG.mobileHint;
        }

        // Reset view
        if (this.viewer && this.initialView) {
            this.viewer.lookAt(this.initialView.pitch || 0,
                               this.initialView.yaw || 0,
                               this.initialView.hfov || 100);
        }
    }
};

})(window);
