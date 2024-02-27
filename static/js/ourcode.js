let attempts = 0;
let irrelevantWords = new Set();

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('checkSentence').addEventListener('click', checkSentence);
    document.getElementById('nextSentence').addEventListener('click', showLoadingAndLoadNewSentence);
    document.getElementById('undoSentence').addEventListener('click', resetConstructedSentence);
    loadNewSentence();
});

function loadNewSentence() {
    attempts = 0;
    fetch('/generate_sentence') 
        .then(response => response.json())
        .then(data => {
            const wordsContainer = document.getElementById('wordsContainer');
            const constructedSentence = document.getElementById('constructedSentence');
            wordsContainer.innerHTML = '';
            constructedSentence.innerHTML = '';
            document.getElementById('nextSentence').style.display = 'none';
            document.getElementById('checkSentence').style.display = 'inline-block';
            document.getElementById('undoSentence').style.display = 'none';
            document.getElementById('resultContainer').textContent = '';
            constructedSentence.setAttribute('data-original', data.original.trim());
            data.shuffled.forEach(word => {
                const wordButton = document.createElement('button');
                wordButton.textContent = word; 
                wordButton.className = 'word-button';
                wordButton.onclick = () => {
                    constructedSentence.appendChild(createWordSpan(word));
                    wordButton.remove();
                    toggleUndoButton();
                };
                wordsContainer.appendChild(wordButton);
            });
        })
        .catch(error => {
            console.error('Error loading new sentence:', error);
        });
}

function createWordSpan(word) {
    const wordSpan = document.createElement('span');
    wordSpan.textContent = word + " ";
    wordSpan.className = 'word-span';
    return wordSpan;
}

function checkSentence() {
    const constructedSentenceElement = document.getElementById('constructedSentence');
    let original = constructedSentenceElement.getAttribute('data-original');
    const originalWords = normalizeAndSplitSentence(original);
    const userInputSentence = Array.from(constructedSentenceElement.children).map(span => span.textContent.trim()).join(" ");
    const userInputWords = normalizeAndSplitSentence(userInputSentence);
    const resultContainer = document.getElementById('resultContainer');
    const isValid = compareSentences(originalWords, userInputWords);
    if (isValid) {
        displayCorrectFeedback();
    } else {
        handleIncorrectAnswer();
    }
}

function normalizeAndSplitSentence(sentence) {
    return sentence.toLowerCase().replace(/[^a-zA-Z0-9\s\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g, "").trim().split(/\s+/);
}

function compareSentences(originalWords, userInputWords) {
    const originalSentence = originalWords.join(" ");
    const userInputSentence = userInputWords.join(" ");
    return originalSentence === userInputSentence;
}

function displayCorrectFeedback() {
    const resultContainer = document.getElementById('resultContainer');
    resultContainer.textContent = 'Correct!';
    document.getElementById('nextSentence').style.display = 'inline-block';
    document.getElementById('checkSentence').style.display = 'none';
    updatePoints();
    const popup = document.createElement('div');
    popup.classList.add('popup');
    popup.textContent = 'Correct! Point added ';
    document.body.appendChild(popup);
    setTimeout(() => {
        popup.remove();
    }, 2000);
}


function handleIncorrectAnswer() {
    const resultContainer = document.getElementById('resultContainer');
    attempts++;
    if (attempts >= 2) {
        resultContainer.textContent = `Incorrect. The correct sentence was: "${document.getElementById('constructedSentence').getAttribute('data-original')}"`;
        document.getElementById('nextSentence').style.display = 'inline-block';
        document.getElementById('checkSentence').style.display = 'none';
        resetConstructedSentence();
        attempts = 0;
    } else {
        resultContainer.textContent = 'Incorrect, try again!';
    }
}

function updatePoints() {
    fetch('/update_points', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            console.log('Points updated successfully', data.points);
            if (data.points >= 50) {
                alert("Congratulations! You've reached an advanced level!");
            }
        })
        .catch(error => console.error('Error updating points:', error));
}


function resetConstructedSentence() {
    const wordsContainer = document.getElementById('wordsContainer');
    Array.from(document.getElementById('constructedSentence').children).forEach(wordSpan => {
        const wordButton = document.createElement('button');
        wordButton.textContent = wordSpan.textContent.trim();
        wordButton.className = 'word-button';
        wordButton.onclick = () => {
            constructedSentence.appendChild(createWordSpan(wordButton.textContent));
            wordButton.remove();
            toggleUndoButton();
        };
        wordsContainer.appendChild(wordButton);
    });
    document.getElementById('constructedSentence').innerHTML = '';
    toggleUndoButton();
}

function showLoadingAndLoadNewSentence() {
    const nextSentenceButton = document.getElementById('nextSentence');
    nextSentenceButton.disabled = true;
    nextSentenceButton.innerHTML = 'Loading...';
    setTimeout(() => {
        loadNewSentence();
        nextSentenceButton.disabled = false;
        nextSentenceButton.innerHTML = 'Next Sentence';
        nextSentenceButton.style.display = 'none';
    }, 1000);
}

function toggleUndoButton() {
    const constructedSentence = document.getElementById('constructedSentence');
    const undoButton = document.getElementById('undoSentence');
    const hasWords = constructedSentence.querySelectorAll('.word-span').length > 0;
    undoButton.style.display = hasWords ? 'inline-block' : 'none';
}

try {
    const userId = sessionStorage.getItem('user_id');
    console.log(userId);
	console.log(sessionStorage)
} catch (error) {
    console.error('Error retrieving user_id from session storage:', error);
}
const userId = document.cookie.split('; ').find(row => row.startsWith('user_id=')).split('=')[1];
fetch(`/api/users/${userId}`)
	.then(response => {
	  if (!response.ok) {
		throw new Error('Network response was not ok');
	  }
	  return response.json();
	})
	.then(data => {
      const userData = JSON.parse(data);
      const username = userData.username;
      const selected_language=userData.wanted_language;
      const level = userData.level;
      const levels = document.querySelectorAll('.level');
      const point=userData.points[0].points
      const point_history=userData.point_history
      console.log(point_history)
      let maxPoints = 50;
      if (level === 'advanced') {
          maxPoints = 100; 
      }

      const completionRate = (point / maxPoints) * 100;
      const progressBar = document.getElementById('progress-bar');
            levels.forEach(levelElement => {
          levelElement.textContent = level;
      });
      document.getElementById('username').textContent = username;

    const languageOptions = document.querySelectorAll('.language-option');

    languageOptions.forEach(option => {
        const lang = option.querySelector('.flag').getAttribute('data-lang');
        if (lang === selected_language) {
            option.classList.add('selected-language');
        }
    });
      document.getElementById('username').textContent = username;
      document.getElementById('level').textContent = level;
      const welcomeMessage = document.getElementById('welcome-message');
      const nature= document.getElementById('nature');
      welcomeMessage.textContent += ` ${username}`;
      nature.textContent += ` ${level}`;
      progressBar.style.width = `${completionRate}%`;
      progressBar.setAttribute('aria-valuenow', completionRate);
      progressBar.setAttribute('aria-label', `${completionRate}% Complete`);
      progressBar.querySelector('.visually-hidden').textContent = `${completionRate}% Complete`;
      const labels = userData.point_history.map(item => item.date_earned.$date);
        const points = userData.point_history.map(item => item.points_earned);
        updateChart(labels, points);
        
	})
    .then(userData => {
        const labels = userData.point_history.map(item => item.date_earned.$date);
        const points = userData.point_history.map(item => item.points_earned);
        updateChart(labels, points);
    })
	.catch(error => {
	  console.error('There was a problem with the fetch operation:', error);
	});
    function updateChart(labels, points) {
        window.ApexCharts && (new ApexCharts(document.getElementById('chart-revenue-bg'), {
            chart: {
                type: "area",
                fontFamily: 'inherit',
                height: 40.0,
                sparkline: {
                    enabled: true
                },
                animations: {
                    enabled: false
                },
            },
            dataLabels: {
                enabled: false,
            },
            fill: {
                opacity: .16,
                type: 'solid'
            },
            stroke: {
                width: 2,
                lineCap: "round",
                curve: "smooth",
            },
            series: [{
                name: "Points earned",
                data: points
            }],
            tooltip: {
                theme: 'dark'
            },
            grid: {
                strokeDashArray: 4,
            },
            xaxis: {
                labels: {
                    padding: 0,
                },
                tooltip: {
                    enabled: false
                },
                axisBorder: {
                    show: false,
                },
                type: 'datetime',
                categories: labels
            },
            yaxis: {
                labels: {
                    padding: 4
                },
            },
            colors: [tabler.getColor("primary")],
            legend: {
                show: false,
            },
        })).render();
    }
    function setSelectedLanguage(lang) {
        document.getElementById('selected_language').value = lang;
    }
    
    const flags = document.querySelectorAll('.flag');
    
    flags.forEach(flag => {
        flag.addEventListener('click', () => {
            const lang = flag.getAttribute('data-lang');
            console.log(lang);
            setSelectedLanguage(lang);
            flags.forEach(f => {
                if (f === flag) {
                    f.classList.add('selected-flag');
                } else {
                    f.classList.remove('selected-flag');
                }
            });
            fetch(`/api/users/update_wanted_language/${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({'wanted_language': lang })
            })
            .then(response => {
                console.log(response);
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                console.log(data);
                window.location.href = window.location.href;
            })
            .catch(error => {
                console.error('There was a problem with the fetch operation:', error);
            });
        });
    });
    