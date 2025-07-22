import React, { useState } from 'react';
import '../styles/InputSection.css';
import { trackEvent } from '../firebase.js';
import AudioRecorder from './AudioRecorder';

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
        
        case 'document':
        case 'image':
          if (!file) {
            throw new Error('Please select a file');
          }
          
          console.log('Submitting file:', file.name, file.type, file.size);
          
          // Track file submission
          trackEvent('file_submitted', {
            file_type: file.type,
            file_size: file.size,
            input_type: inputType
          });
          
          // Convert all files to base64 for unified processing
          const reader = new FileReader();
          reader.onload = (e) => {
            const base64Data = e.target.result.split(',')[1]; // Remove data:...;base64, prefix
            onSubmit({ 
              type: 'file', 
              fileData: base64Data,
              fileName: file.name, 
              fileType: file.type,
              userTimeZone: userTimeZone
            });
          };
          reader.onerror = () => {
            throw new Error('Failed to read file');
          };
          reader.readAsDataURL(file);
          return; // Exit early for async processing
        
        case 'audio':
          // Audio handling is done through the AudioRecorder component callback
          // This case should not be reached as audio is handled via onAudioReady
          throw new Error('Audio submission should be handled by the AudioRecorder component');
        
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
          <span className="tab-icon text-icon">📝</span>
          <span className="tab-label">Text</span>
        </button>
        <button 
          className={`input-type-button ${inputType === 'document' ? 'active' : ''}`}
          onClick={() => handleInputTypeChange('document')}
        >
          <span className="tab-icon document-icon">📄</span>
          <span className="tab-label">Document</span>
        </button>
        <button 
          className={`input-type-button ${inputType === 'image' ? 'active' : ''}`}
          onClick={() => handleInputTypeChange('image')}
        >
          <span className="tab-icon image-icon">📷</span>
          <span className="tab-label">Image</span>
        </button>
        <button 
          className={`input-type-button ${inputType === 'audio' ? 'active' : ''}`}
          onClick={() => handleInputTypeChange('audio')}
        >
          <span className="tab-icon audio-icon">🎤</span>
          <span className="tab-label">Audio</span>
        </button>
        <button 
          className={`input-type-button ${inputType === 'url' ? 'active' : ''}`}
          onClick={() => handleInputTypeChange('url')}
        >
          <span className="tab-icon url-icon">🌐</span>
          <span className="tab-label">URL</span>
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

        {inputType === 'document' && (
          <div className="file-input-container">
            <input
              type="file"
              onChange={(e) => setFile(e.target.files[0])}
              accept=".pdf,.doc,.docx,.txt,.rtf"
              disabled={isLoading}
            />
            <p className="input-help-text">
              Supported formats: PDF, DOC, DOCX, TXT, RTF
            </p>
          </div>
        )}
        
        {inputType === 'image' && (
          <div className="file-input-container">
            <input
              type="file"
              onChange={(e) => setFile(e.target.files[0])}
              accept=".png,.jpg,.jpeg,.webp,.heif"
              disabled={isLoading}
            />
            <p className="input-help-text">
              Supported formats: PNG, JPG, JPEG, WebP, HEIF
            </p>
          </div>
        )}
        
        {inputType === 'audio' && (
          <AudioRecorder 
            onAudioReady={(audioFile) => {
              // Track audio submission
              trackEvent('audio_submitted', {
                duration: audioFile.size,
                file_type: audioFile.type
              });
              
              // Convert audio file to base64 for backend processing
              const reader = new FileReader();
              reader.onload = (e) => {
                const base64Data = e.target.result.split(',')[1];
                onSubmit({ 
                  type: 'file', 
                  fileData: base64Data,
                  fileName: audioFile.name, 
                  fileType: audioFile.type,
                  userTimeZone: userTimeZone
                });
              };
              reader.onerror = () => {
                setError('Failed to process audio file');
              };
              reader.readAsDataURL(audioFile);
            }}
            isLoading={isLoading}
          />
        )}
        
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

        {inputType !== 'audio' && (
          <button 
            type="submit" 
            className="submit-button"
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : 'Extract Events'}
          </button>
        )}
      </form>
    </div>
  );
};

export default InputSection;
