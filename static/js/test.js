let generatedPrompt = '';

async function expandOnTopic(prompt) {
    try {
        const generatedCodeSection = document.getElementById('generatedCode');
        generatedCodeSection.innerHTML = '<div class="loader"></div>';
        const response = await fetch(`/expand_on_topic`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt: prompt })
        });
        const data = await response.json();
        generatedPrompt=data.original;
        return data.original;
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}

const submitBtn = document.getElementById('submitBtn');
submitBtn.addEventListener('click', async () => {
    const inputField = document.getElementById('topic');
    const userPrompt = inputField.value;
    const generatedSentence = await expandOnTopic(userPrompt);
    const generatedCodeSection = document.getElementById('generatedCode');
    generatedCodeSection.innerHTML = '<h2>Your Generated Topic!</h2>';
    for (let i = 0; i < generatedSentence.length; i++) {
        setTimeout(() => {
            generatedCodeSection.innerHTML += generatedSentence[i];
            generatedCodeSection.style.height = `${generatedCodeSection.scrollHeight}px`;
        }, i * 30);
    }
    generatedCodeSection.style.padding = '30px';
    const generateTestBtn = document.getElementById('generateTestBtn');
    generateTestBtn.style.visibility = 'visible';

});
async function generateTest() {
    try {
        const response = await fetch('/generate_multiple_choice_questions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ topic: generatedPrompt })
        });

        const data = await response.json();
        console.log(data);
        const questions = data.questions;
        const generatedCodeSection = document.getElementById('questions');
        generatedCodeSection.innerHTML = '<h2>Generated Questions</h2>';
        const maxQuestions = Math.min(questions.length, 5);
        for (let index = 0; index < maxQuestions; index++) {
            const fullQuestion = questions[index];
            const parts = fullQuestion.split('\n').filter(part => part.trim() !== ''); 
            const questionText = parts.shift();
            generatedCodeSection.innerHTML += `
                <div class="form-group">
                    <label for="question-${index}">${questionText}</label><br>
                    ${parts.map((opt, optIndex) => `
                    <div class="form-check">
                        <input class="form-check-input" type="radio" name="question-${index}" id="radio-${index}-${optIndex}" value="${optIndex}">
                        <label class="form-check-label" for="radio-${index}-${optIndex}">${opt}</label>
                    </div>
                    `).join('')}
                </div>
            `;
        }
        const submitButton = document.getElementById('submitTest');
        submitButton.style.visibility = 'visible';
        submitButton.addEventListener('click', submitTest); 

    } catch (error) {
        console.error('Error:', error);
    }
}

async function submitTest() {
    const selectedOptions = [];
    const resultContainer = document.getElementById('result_container');
    const loadingSpinner = document.createElement('div');
    loadingSpinner.classList.add('loader');
    resultContainer.querySelector('.card-body').appendChild(loadingSpinner);
    resultContainer.style.visibility = 'hidden';
    for (let index = 0; index < 4; index++) {
        const questionText = document.querySelector(`label[for="question-${index}"]`).textContent;
        const options = [];
        const selectedOption = document.querySelector(`input[name="question-${index}"]:checked`);
        const selectedOptionIndex = selectedOption ? parseInt(selectedOption.value) : -1;
        for (let optIndex = 0; optIndex < 4; optIndex++) {
            const optionText = document.querySelector(`label[for="radio-${index}-${optIndex}"]`).textContent.trim();
            options.push(optionText);
        }
        selectedOptions.push({
            question: questionText,
            options: options,
            selectedOptionIndex: selectedOptionIndex
        });
    }
    try {
        const response = await fetch('/submit_test', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ selectedOptions: selectedOptions })
        });
        loadingSpinner.remove();
        resultContainer.style.visibility = 'visible';
        const responseData = await response.json();
        if (responseData.error) {
            console.error('Error:', responseData.error);
            return;
        }
        const tryButton = document.getElementById('tryBtn');
        tryButton.style.display = 'block';
        const evaluationResultDiv = document.getElementById('evaluationResult');
        evaluationResultDiv.innerHTML = '';
        const evaluationResults = JSON.parse(responseData.evaluation_result);
        evaluationResults.forEach(result => {
            const p = document.createElement('p');
            const isCorrect = result.answer.trim().toLowerCase() === result.user_answer.trim().toLowerCase();
            const icon = document.createElement('img');
            icon.src = isCorrect ? './static/img/checked.png' : './static/img/cancel.png';
            icon.alt = isCorrect ? 'Correct' : 'Incorrect';
            icon.classList.add('icon');
            const userAnswerSpan = document.createElement('span');
            userAnswerSpan.textContent = `Your Answer: ${result.user_answer}`;
            userAnswerSpan.style.color = isCorrect ? 'green' : 'red';
            p.appendChild(icon);
            p.appendChild(document.createTextNode(' '));
            p.appendChild(userAnswerSpan);
            p.appendChild(document.createElement('br'));
            const questionText = document.createTextNode(`Question: ${result.question}`);
            p.appendChild(questionText);
            p.appendChild(document.createElement('br'));
            const correctAnswerText = document.createTextNode(`Correct Answer: ${result.answer}`);
            p.appendChild(correctAnswerText);
            evaluationResultDiv.appendChild(p);
        });
    } catch (error) {
        console.error('Error submitting test:', error);
    }
}

const generateTestBtn = document.getElementById('generateTestBtn');
generateTestBtn.addEventListener('click', generateTest);

const tryButton = document.getElementById('tryBtn');
tryButton.addEventListener('click', () => {
    window.location.reload();
});