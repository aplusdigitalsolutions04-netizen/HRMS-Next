import React from 'react';
import { Issued } from '../Letters';

// The employee's own letters (offer, appointment, experience, relieving ...) made by HR, to open as a PDF.
export default function MyLetters() {
  return (
    <div>
      <div className="ph">
        <div>
          <h1>My Letters</h1>
          <p>The letters HR has issued to you. Open one to read it or save it as a PDF.</p>
        </div>
      </div>
      <Issued isHr={false} />
    </div>
  );
}
