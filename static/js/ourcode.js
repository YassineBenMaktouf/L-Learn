let attempts = 0;
let irrelevantWords = new Set();

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('checkSentence').addEventListener('click', checkSentence);
    document.getElementById('nextSentence').addEventListener('click', showLoadingAndLoadNewSentence);
    document.getElementById('undoSentence').addEventListener('click', resetConstructedSentence);
    loadNewSentence();
});

function loadNewSentence() {
    attempts = 0; // Reset the attempts for the new sentence
    fetch('/generate_sentence') // Request a new sentence from the server
        .then(response => response.json()) // Parse the JSON response
        .then(data => {
            // Clear previous sentence and words setup
            const wordsContainer = document.getElementById('wordsContainer');
            const constructedSentence = document.getElementById('constructedSentence');
            wordsContainer.innerHTML = ''; // Clear previous words
            constructedSentence.innerHTML = ''; // Clear the constructed sentence area
            document.getElementById('nextSentence').style.display = 'none'; // Hide the next sentence button initially
            document.getElementById('checkSentence').style.display = 'inline-block'; // Show the check sentence button
            document.getElementById('undoSentence').style.display = 'none'; // Hide the undo button initially
            document.getElementById('resultContainer').textContent = ''; // Clear any previous result message

            // Set the original sentence in a data attribute for later comparison
            constructedSentence.setAttribute('data-original', data.original.trim());

            // Display shuffled words as clickable buttons
            data.shuffled.forEach(word => {
                const wordButton = document.createElement('button');
                wordButton.textContent = word; // Set the button text to the word
                wordButton.className = 'word-button'; // Apply styling class
                wordButton.onclick = () => {
                    // When a word is clicked, move it to the constructed sentence and remove the button
                    constructedSentence.appendChild(createWordSpan(word)); // Add the word to the constructed sentence
                    wordButton.remove(); // Remove the word button from the available words
                    toggleUndoButton(); // Check if the undo button should be shown
                };
                wordsContainer.appendChild(wordButton); // Add the word button to the container
            });
        })
        .catch(error => {
            console.error('Error loading new sentence:', error); // Log errors if the request fails
        });
}

function createWordSpan(word) {
    const wordSpan = document.createElement('span'); // Create a new span for the word
    wordSpan.textContent = word + " "; // Set the text content to the word, adding a space for readability
    wordSpan.className = 'word-span'; // Apply styling class
    return wordSpan; // Return the created word span
}

function checkSentence() {
    const constructedSentenceElement = document.getElementById('constructedSentence');
    let original = constructedSentenceElement.getAttribute('data-original');
    const originalWords = normalizeAndSplitSentence(original);
    // Map to get textContent and normalize each word span, then join back into a sentence.
    const userInputSentence = Array.from(constructedSentenceElement.children).map(span => span.textContent.trim()).join(" ");
    const userInputWords = normalizeAndSplitSentence(userInputSentence);
    const resultContainer = document.getElementById('resultContainer');
    // Updated to use the newly adjusted logic for comparison.
    const isValid = compareSentences(originalWords, userInputWords);
    if (isValid) {
        displayCorrectFeedback();
    } else {
        handleIncorrectAnswer();
    }
}

function normalizeAndSplitSentence(sentence) {
    return sentence.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, "").trim().split(/\s+/);
}

function compareSentences(originalWords, userInputWords) {
    // Join words back into a sentence for comparison, to handle additional spaces correctly.
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
    const hasWords = constructedSentence.querySelectorAll('.word-span').length > 0; // Check if there are words in the constructed sentence
    undoButton.style.display = hasWords ? 'inline-block' : 'none'; // Show or hide the undo button based on whether there are words
}

try {
    const userId = sessionStorage.getItem('user_id');
    console.log(userId);
	console.log(sessionStorage)
} catch (error) {
    console.error('Error retrieving user_id from session storage:', error);
}
const userId = document.cookie.split('; ').find(row => row.startsWith('user_id=')).split('=')[1];
fetch(`http://127.0.0.1:5000/api/users/${userId}`)
	.then(response => {
	  if (!response.ok) {
		throw new Error('Network response was not ok');
	  }
	  return response.json();
	})
	.then(data => {
	  // Handle the JSON response here
      console.log(data)
      const userData = JSON.parse(data);
      console.log()
      const username = userData.username;
      const selected_language=userData.wanted_language;
      const level = userData.level;
      const levels = document.querySelectorAll('.level');
      const point=userData.points[0].points
      const completionRate = (point / 50) * 100; // Assuming 50 is the maximum points
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
	})
	.catch(error => {
	  console.error('There was a problem with the fetch operation:', error);
	});
    

    
    
    function setSelectedLanguage(lang) {
        document.getElementById('selected_language').value = lang;
    }
    
    const flags = document.querySelectorAll('.flag');
    
    flags.forEach(flag => {
        flag.addEventListener('click', () => {
            // Get the value of the 'data-lang' attribute
            const lang = flag.getAttribute('data-lang');
            console.log(lang);
            
            // Set the selected language immediately
            setSelectedLanguage(lang);
            
            // Update the flag highlighting
            flags.forEach(f => {
                if (f === flag) {
                    f.classList.add('selected-flag');
                } else {
                    f.classList.remove('selected-flag');
                }
            });
    
            // Make the fetch request to update the wanted language
            fetch(`http://127.0.0.1:5000/api/users/update_wanted_language/${userId}`, {
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
                // Handle the JSON response if needed
                console.log(data);
                window.location.href = window.location.href;

            })
            .catch(error => {
                console.error('There was a problem with the fetch operation:', error);
            });
        });
    });
    