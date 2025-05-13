
/**
 * Content script for detecting form fields and autofilling credentials
 */

// Regular expressions for field detection
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_FIELD_REGEX = /username|email|login|user|account/i;
const PASSWORD_FIELD_REGEX = /password|pass|pwd/i;
const FORM_FIELD_REGEX = /signup|signin|login|register|create[_\s]account/i;

// Store the detected form type
let formType = null; // 'login' or 'signup' or null
let detectedFields = {
  username: null,
  password: null,
  confirmPassword: null
};

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'fillCredentials') {
    fillCredentials(message.credentials);
    sendResponse({ success: true });
    return true;
  } else if (message.action === 'getFormData') {
    const formData = getFormData();
    sendResponse({ formData });
    return true;
  } else if (message.action === 'detectForms') {
    detectForms();
    sendResponse({ success: true });
    return true;
  }
  return true;
});

// Initialize the content script
function init() {
  // Wait for the DOM to be fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDOMLoaded);
  } else {
    onDOMLoaded();
  }
  
  // Also listen for changes in the DOM to detect dynamically added forms
  observeDOMChanges();
}

// Handle DOM loaded event
function onDOMLoaded() {
  detectForms();
  
  // Monitor form submissions to capture credentials
  document.addEventListener('submit', onFormSubmit);
}

// Observe DOM changes to detect dynamically added forms
function observeDOMChanges() {
  const observer = new MutationObserver((mutations) => {
    let shouldDetect = false;
    
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'FORM' || node.querySelector('form, input[type="password"]')) {
              shouldDetect = true;
              break;
            }
          }
        }
      }
      if (shouldDetect) break;
    }
    
    if (shouldDetect) {
      detectForms();
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Detect forms on the page
function detectForms() {
  // Reset the detected fields
  detectedFields = {
    username: null,
    password: null,
    confirmPassword: null
  };
  
  // Look for password fields first
  const passwordFields = Array.from(document.querySelectorAll('input[type="password"]'));
  
  if (passwordFields.length === 0) {
    return; // No password fields found
  }
  
  // We found at least one password field
  detectedFields.password = passwordFields[0];
  
  // If there are two password fields, it's likely a signup form
  if (passwordFields.length >= 2) {
    formType = 'signup';
    detectedFields.confirmPassword = passwordFields[1];
  } else {
    formType = 'login';
  }
  
  // Now look for the username/email field that's typically before the password field
  const formElement = detectedFields.password.form || 
                      detectedFields.password.closest('form') || 
                      document.body;
  
  const inputFields = Array.from(formElement.querySelectorAll('input:not([type="password"])')).filter(field => {
    const type = field.type.toLowerCase();
    return type === 'text' || type === 'email' || type === '' || !type;
  });
  
  // Try to find the username field based on various heuristics
  for (const field of inputFields) {
    const id = field.id.toLowerCase();
    const name = field.name.toLowerCase();
    const placeholder = (field.placeholder || '').toLowerCase();
    const label = findLabelForInput(field);
    
    // First priority: explicit email fields
    if (field.type === 'email' || 
        id.includes('email') || 
        name.includes('email') || 
        placeholder.includes('email') ||
        (label && label.includes('email'))) {
      detectedFields.username = field;
      break;
    }
    
    // Second priority: username fields
    if (USERNAME_FIELD_REGEX.test(id) || 
        USERNAME_FIELD_REGEX.test(name) || 
        USERNAME_FIELD_REGEX.test(placeholder) ||
        (label && USERNAME_FIELD_REGEX.test(label))) {
      detectedFields.username = field;
      // Don't break here, continue looking for an explicit email field
    }
  }
  
  // If we still haven't found a username field, just take the input field before the password
  if (!detectedFields.username && inputFields.length > 0) {
    const passwordIndex = Array.from(formElement.querySelectorAll('input')).indexOf(detectedFields.password);
    
    for (let i = passwordIndex - 1; i >= 0; i--) {
      const field = formElement.querySelectorAll('input')[i];
      if (field.type !== 'hidden' && field.type !== 'password' && field.type !== 'submit') {
        detectedFields.username = field;
        break;
      }
    }
  }
  
  // Notify the background script about the detected form
  if (detectedFields.username && detectedFields.password) {
    chrome.runtime.sendMessage({
      action: 'formDetected',
      data: {
        formType,
        url: window.location.href,
        domain: window.location.hostname
      }
    });
  }
}

// Helper function to find a label for an input field
function findLabelForInput(input) {
  // First, try to find a label that's explicitly associated with this input
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) {
      return label.textContent.trim().toLowerCase();
    }
  }
  
  // Next, check if the input is inside a label
  const parentLabel = input.closest('label');
  if (parentLabel) {
    return parentLabel.textContent.trim().toLowerCase();
  }
  
  // Finally, look for nearby labels or text nodes
  const parentElement = input.parentElement;
  if (parentElement) {
    // Check for labels or divs with class/id containing 'label'
    const nearbyLabels = parentElement.querySelectorAll('label, div[class*="label"], div[id*="label"], span[class*="label"]');
    for (const label of nearbyLabels) {
      if (label.textContent.trim()) {
        return label.textContent.trim().toLowerCase();
      }
    }
  }
  
  return null;
}

// Fill credentials into form fields
function fillCredentials(credentials) {
  if (!detectedFields.username || !detectedFields.password) {
    detectForms();
  }
  
  if (detectedFields.username && credentials.username) {
    detectedFields.username.value = credentials.username;
    triggerInputEvent(detectedFields.username);
  }
  
  if (detectedFields.password && credentials.password) {
    detectedFields.password.value = credentials.password;
    triggerInputEvent(detectedFields.password);
  }
}

// Trigger input events to notify the page of value changes
function triggerInputEvent(element) {
  const inputEvent = new Event('input', { bubbles: true });
  const changeEvent = new Event('change', { bubbles: true });
  
  element.dispatchEvent(inputEvent);
  element.dispatchEvent(changeEvent);
}

// Handle form submission
function onFormSubmit(event) {
  if (!detectedFields.username || !detectedFields.password) {
    detectForms();
  }
  
  if (detectedFields.username && detectedFields.password) {
    const formData = {
      domain: window.location.hostname,
      url: window.location.href,
      username: detectedFields.username.value,
      password: detectedFields.password.value,
      formType
    };
    
    // Only capture credentials if both username and password are provided
    if (formData.username && formData.password) {
      // Send the captured credentials to the background script
      chrome.runtime.sendMessage({
        action: 'saveCredentials',
        data: formData
      });
    }
  }
}

// Get form data for the current page
function getFormData() {
  if (!detectedFields.username || !detectedFields.password) {
    detectForms();
  }
  
  if (detectedFields.username && detectedFields.password) {
    return {
      domain: window.location.hostname,
      hasForm: true,
      formType
    };
  }
  
  return {
    domain: window.location.hostname,
    hasForm: false
  };
}

// Initialize the content script
init();
