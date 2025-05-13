
import React from 'react';

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-600 text-white p-6">
      <div className="max-w-3xl text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-6">SecureCredentials Browser Extension</h1>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 shadow-lg mb-8">
          <p className="text-xl leading-relaxed mb-4">
            This is a secure browser extension that automatically detects and saves user credentials 
            (emails, passwords, full names, etc.) and intelligently fills them in web forms when detected.
          </p>
          <p className="text-lg leading-relaxed mb-6">
            Built with advanced security features including encryption, phishing protection, and master password protection.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            <div className="bg-white/10 p-4 rounded-lg">
              <h3 className="font-bold text-xl mb-2">Key Features</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Auto-detection of login forms</li>
                <li>Secure, encrypted credential storage</li>
                <li>Smart auto-fill functionality</li>
                <li>Master password protection</li>
                <li>Phishing protection</li>
              </ul>
            </div>
            
            <div className="bg-white/10 p-4 rounded-lg">
              <h3 className="font-bold text-xl mb-2">Security Measures</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>AES-256 encryption with PBKDF2</li>
                <li>No plaintext password storage</li>
                <li>Domain verification before auto-fill</li>
                <li>Protection against non-HTTPS sites</li>
                <li>Browser's secure storage API</li>
              </ul>
            </div>
          </div>
        </div>
        
        <h2 className="text-2xl font-bold mb-4">How to Use This Extension</h2>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 shadow-lg">
          <p className="mb-4">To use this browser extension:</p>
          <ol className="list-decimal pl-8 text-left space-y-2 mb-4">
            <li>Download the extension files</li>
            <li>Go to your browser's extension management page</li>
            <li>Enable developer mode</li>
            <li>Select "Load unpacked" and choose the extension folder</li>
            <li>The extension will appear in your toolbar</li>
            <li>Set your master password on first use</li>
            <li>Visit websites and allow the extension to save your credentials</li>
          </ol>
          <p className="text-sm italic">
            Note: This is a developer version. For a production-ready extension, it would need to be
            submitted to browser extension stores.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
