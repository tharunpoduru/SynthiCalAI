import React from 'react';
import EventCard from './EventCard';
import '../styles/EventCardList.css';

const EventCardList = ({ events }) => {
  // Don't render anything if no events are available
  if (!events || events.length === 0) {
    return null;
  }
  
  return (
    <div className="event-card-list">
      {events.map((event, index) => (
        <EventCard key={`event-${index}`} event={event} />
      ))}
    </div>
  );
};

export default EventCardList;
