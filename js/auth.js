document.addEventListener('DOMContentLoaded', function() {
    const auth = firebase.auth();
    const database = firebase.database();
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const errorMessage = document.getElementById('error-message');
    const ADMIN_EMAIL = 'adm.ti@empresa.com';

    // Function to display errors
    function showError(message) {
        if (errorMessage) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
        }
    }

    // Function to hide errors
    function hideError() {
        if (errorMessage) {
            errorMessage.style.display = 'none';
        }
    }

    // Login
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            hideError();

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            auth.signInWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    if (userCredential.user.email === ADMIN_EMAIL) {
                        window.location.href = 'admin.html';
                    } else {
                        window.location.href = 'home.html';
                    }
                })
                .catch((error) => {
                    showError(error.message);
                });
        });
    }

    // Signup
    if (signupForm) {
        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            hideError();

            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            auth.createUserWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    const user = userCredential.user;
                    // Save user info to database
                    database.ref('usuarios/' + user.uid).set({
                        nome: name,
                        email: email
                    });
                    // Update user profile
                    user.updateProfile({
                        displayName: name
                    }).then(() => {
                         window.location.href = 'home.html';
                    });
                })
                .catch((error) => {
                    showError(error.message);
                });
        });
    }
});
