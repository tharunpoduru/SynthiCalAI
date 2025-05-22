import React, { useState } from 'react';
import '../styles/InputSection.css';
import { trackEvent } from '../firebase.js';

const InputSection = ({ onSubmit, isLoading, userTimeZone }) => {
  const [inputType, setInputType] = useState('text');
  const [textInput, setTextInput] = useState('');
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState(null);

  const handleInputTypeChange = (newInputType) => {
    // Track input type change
    trackEvent('input_type_changed', {
      previous: inputType,
      new: newInputType
    });
    
    setInputType(newInputType);
    // Reset input values and error when the input type changes
    setTextInput('');
    setFile(null);
    setUrl('');
    setError(null);
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      switch (inputType) {
        case 'text':
          if (!textInput.trim()) {
            throw new Error('Please enter some text');
          }
          
          // Track text submission
          trackEvent('text_submitted', {
            text_length: textInput.length
          });
          
          onSubmit({ type: 'text', content: textInput, userTimeZone });
          break;
        
        case 'file':
          if (!file) {
            throw new Error('Please select a file');
          }
          // Create a fresh FormData object
          const formData = new FormData();
          // Important: append the file first
          formData.append('file', file);
          formData.append('userTimeZone', userTimeZone);
          
          // Debug: log what we're sending
          console.log('Submitting file:', file.name, file.type, file.size);
          
          // Track file submission
          trackEvent('file_submitted', {
            file_type: file.type,
            file_size: file.size
          });
          
          onSubmit({ type: 'file', formData, fileName: file.name, fileType: file.type });
          break;
        
        case 'url':
          if (!url.trim()) {
            throw new Error('Please enter a URL');
          }
          
          // Track URL submission
          trackEvent('url_submitted', {
            url_domain: new URL(url).hostname
          });
          
          onSubmit({ type: 'url', url, userTimeZone });
          break;
        
        default:
          throw new Error('Invalid input type');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="input-section">
      <div className="input-type-selector">
        <button 
          className={`input-type-button ${inputType === 'text' ? 'active' : ''}`}
          onClick={() => handleInputTypeChange('text')}
        >
          Text
        </button>
        {/* Hidden Document/Image tab until it's fixed
        <button 
          className={`input-type-button ${inputType === 'file' ? 'active' : ''}`}
          onClick={() => handleInputTypeChange('file')}
        >
          Document/Image
        </button>
        */}
        <button 
          className={`input-type-button ${inputType === 'url' ? 'active' : ''}`}
          onClick={() => handleInputTypeChange('url')}
        >
          URL
        </button>
      </div>

      <form onSubmit={handleSubmit}>
      <input type="hidden" name="userTimeZone" value={userTimeZone} />

        {inputType === 'text' && (
          <div className="text-input-container">
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Paste or type event information here..."
              rows={6}
              disabled={isLoading}
            />
          </div>
        )}

        {/* Hide file input section as well 
        {inputType === 'file' && (
          <div className="file-input-container">
            <input
              type="file"
              onChange={(e) => setFile(e.target.files[0])}
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              disabled={isLoading}
            />
            <p className="input-help-text">
              Supported formats: PDF, DOC, DOCX, PNG, JPG, JPEG
            </p>
          </div>
        )}
        */}
        
        {inputType === 'url' && (
          <div className="url-input-container">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/event-page"
              disabled={isLoading}
            />
          </div>
        )}

        {error && <div className="input-error">{error}</div>}

        <button 
          type="submit" 
          className="submit-button"
          disabled={isLoading}
        >
          {isLoading ? 'Processing...' : 'Extract Events'}
        </button>
      </form>
    </div>
  );
};

export default InputSection;
