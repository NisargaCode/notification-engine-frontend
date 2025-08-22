import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [visiblePopupId, setVisiblePopupId] = useState(null);
  const [selectedTrainingIds, setSelectedTrainingIds] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);
  const [rescheduleData, setRescheduleData] = useState({
    title: '',
    trainerName: '',
    userEmail: '',
    dueDate: '',
  });
  const [newTraining, setNewTraining] = useState({
    title: '',
    trainerName: '',
    userEmail: '',
    dueDate: '',
  });
  const [showAddTrainingForm, setShowAddTrainingForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // ⭐ To control which view is active (dashboard, upcoming, ongoing, overdue)
  const [activeView, setActiveView] = useState('dashboard'); // Default to 'dashboard' (all)

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Delete' && selectedTrainingIds.length > 0) {
        setShowDeleteModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTrainingIds]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (visiblePopupId &&
        !event.target.closest('.details-popup') &&
        !event.target.closest('.view-details-btn')) {
        setVisiblePopupId(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [visiblePopupId]);


  const handleCheckboxChange = (trainingId) => {
    setSelectedTrainingIds(prev =>
      prev.includes(trainingId)
        ? prev.filter(id => id !== trainingId)
        : [...prev, trainingId]
    );
  };

  const confirmDeleteSelectedTrainings = async () => {
    try {
      const numToDelete = selectedTrainingIds.length;
      let deletedCount = 0;
      for (const id of selectedTrainingIds) {
        const response = await fetch(`http://localhost:8080/api/trainings/${id}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          deletedCount++;
        } else {
          console.error(`Failed to delete training ${id}:`, await response.text());
        }
      }

      setSuccessMessage(`${deletedCount} training(s) deleted successfully!`);
      setShowSuccessModal(true);

      setSelectedTrainingIds([]);
      setShowDeleteModal(false);
      fetchTrainings(searchTerm, activeView);
    } catch (err) {
      console.t(err, "Error deleting trainings:", err);
      alert("Failed to delete some trainings. Please check console for details.");
    }
  };


  const transformTrainingData = (backendTraining) => {
    const dueDate = new Date(backendTraining.dueDate);
    if (isNaN(dueDate.getTime())) {
      console.error("Invalid date for training:", backendTraining);
      return null;
    }

    const now = new Date();

    // ⭐ REVERTED LOGIC: Determine notification status based on sent/missed/pending ⭐
    const anyNotificationsSent = [
      backendTraining.notifiedTwoDaysBefore,
      backendTraining.notifiedOneDayBefore,
      backendTraining.notifiedOneHourBefore,
      backendTraining.notifiedThirtyMinutesBefore
    ].some(Boolean);

    let notificationStatus;
    if (anyNotificationsSent) {
      notificationStatus = 'Sent';
    } else if (dueDate < now) {
      notificationStatus = 'Missed';
    } else {
      notificationStatus = 'Pending';
    }

    // Format date and time
    const year = dueDate.getFullYear();
    const month = String(dueDate.getMonth() + 1).padStart(2, '0');
    const day = String(dueDate.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    const hours = dueDate.getHours();
    const minutes = String(dueDate.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
    const timeString = `${formattedHours}:${minutes} ${ampm}`;

    return {
      id: backendTraining.id,
      date: dateString,
      time: timeString,
      title: backendTraining.title,
      trainerName: backendTraining.trainerName || 'N/A',
      userEmail: backendTraining.userEmail,
      notificationStatus: notificationStatus, // This is now 'Sent', 'Missed', or 'Pending'
      notifiedTwoDaysBefore: backendTraining.notifiedTwoDaysBefore,
      notifiedOneDayBefore: backendTraining.notifiedOneDayBefore,
      notifiedOneHourBefore: backendTraining.notifiedOneHourBefore,
      notifiedThirtyMinutesBefore: backendTraining.notifiedThirtyMinutesBefore,
      rawDueDate: backendTraining.dueDate
    };
  };

  const MEETING_DURATION_MINUTES = 60; // Assume each training lasts for 60 minutes. You can change this value.

const fetchTrainings = async (term = '', viewType = 'dashboard') => {
  try {
    setLoading(true);
    setError(null);

    let url = `http://localhost:8080/api/trainings`;
    if (term) {
      url = `${url}?searchTerm=${term}`;
    }
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    const transformedData = data.map(transformTrainingData).filter(Boolean);

    // ⭐ CORRECTED: Frontend filtering now includes a calculated endTime ⭐
    let filteredData = transformedData;
    const now = new Date();

    if (viewType === 'upcoming') {
      // Upcoming → Trainings where startTime > now.
      filteredData = transformedData.filter(t => new Date(t.rawDueDate) > now);
    } else if (viewType === 'ongoing') {
      // Ongoing → Trainings where startTime ≤ now ≤ endTime.
      filteredData = transformedData.filter(t => {
        const startTime = new Date(t.rawDueDate);
        const endTime = new Date(startTime.getTime() + MEETING_DURATION_MINUTES * 60 * 1000);
        return now >= startTime && now <= endTime;
      });
    } else if (viewType === 'overdue') {
      // Overdue → Trainings where endTime < now.
      filteredData = transformedData.filter(t => {
        const startTime = new Date(t.rawDueDate);
        const endTime = new Date(startTime.getTime() + MEETING_DURATION_MINUTES * 60 * 1000);
        return endTime < now;
      });
    }

    setTrainings(filteredData);

  } catch (err) {
    setError("Failed to load training data. Please try again later.");
    console.error("Error fetching trainings:", err);
  } finally {
    setLoading(false);
  }
};
  const handleRescheduleClick = () => {
    if (selectedTrainingIds.length === 0) {
      alert('Please select at least one training to reschedule.');
      return;
    }

    const firstSelectedTraining = trainings.find(t => t.id === selectedTrainingIds[0]);

    if (firstSelectedTraining) {
      setRescheduleData({
        title: firstSelectedTraining.title,
        trainerName: firstSelectedTraining.trainerName,
        userEmail: firstSelectedTraining.userEmail,
        dueDate: firstSelectedTraining.rawDueDate ? firstSelectedTraining.rawDueDate.substring(0, 16) : '',
      });
    }

    setShowRescheduleForm(true);
    setShowAddTrainingForm(false);
    setVisiblePopupId(null);
  };

  const handleRescheduleChange = (e) => {
    const { name, value } = e.target;
    setRescheduleData(prev => ({ ...prev, [name]: value }));
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();

    if (!rescheduleData.dueDate) {
      alert("Please select a new due date for the training(s).");
      return;
    }

    if (selectedTrainingIds.length === 0) {
      alert("No trainings selected for rescheduling.");
      return;
    }

    const isoNewDueDate = rescheduleData.dueDate + ":00";

    try {
      let updatedCount = 0;
      for (const id of selectedTrainingIds) {
        const originalTraining = trainings.find(t => t.id === id);
        if (!originalTraining) {
          console.warn(`Original training with ID ${id} not found locally.`);
          continue;
        }

        const updatePayload = {
          title: originalTraining.title,
          trainerName: originalTraining.trainerName,
          userEmail: originalTraining.userEmail.split(',').map(email => email.trim()).filter(email => email).join(','),
          dueDate: isoNewDueDate,
          notifiedTwoDaysBefore: false,
          notifiedOneDayBefore: false,
          notifiedOneHourBefore: false,
          notifiedThirtyMinutesBefore: false,
        };

        const response = await fetch(`http://localhost:8080/api/trainings/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload),
        });

        if (response.ok) {
          updatedCount++;
        } else {
          const errorText = await response.text();
          console.error(`Failed to reschedule training ${id}:`, errorText);
        }
      }

      setSuccessMessage(`${updatedCount} of ${selectedTrainingIds.length} training(s) rescheduled successfully!`);
      setShowSuccessModal(true);
      setRescheduleData({ title: '', trainerName: '', userEmail: '', dueDate: '' });
      setSelectedTrainingIds([]);
      setShowRescheduleForm(false);
      fetchTrainings(searchTerm, activeView);

    } catch (err) {
      console.error("Error rescheduling trainings:", err);
      alert("Failed to reschedule some trainings. Please check console for details: " + err.message);
    }
  };

  const handleSendNotification = async (trainingId) => {
    if (!window.confirm("Are you sure you want to send this notification now?")) {
        return;
    }
    try {
        const response = await fetch(`http://localhost:8080/api/trainings/${trainingId}/send-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to send notification: ${response.status} - ${errorText}`);
        }

        alert('Manual notification sent successfully!');

        // ⭐ THE FIX ⭐
        // Re-fetch the training data to get the updated notification status from the backend
        fetchTrainings(searchTerm, activeView);

    } catch (err) {
        console.error("Error sending manual notification:", err);
        alert("Error sending manual notification: " + err.message);
    }
};

  const handleAddTraining = async (e) => {
    e.preventDefault();

    if (!newTraining.title || !newTraining.trainerName || !newTraining.userEmail || !newTraining.dueDate) {
      alert("Please fill in all fields for the new training.");
      return;
    }

    const isoDueDate = newTraining.dueDate + ":00";

    try {
      const response = await fetch('http://localhost:8080/api/trainings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTraining.title,
          trainerName: newTraining.trainerName,
          userEmail: newTraining.userEmail,
          dueDate: isoDueDate,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to add training: ${response.status} - ${errorText}`);
      }

      alert('Training added successfully!');
      setNewTraining({ title: '', trainerName: '', userEmail: '', dueDate: '' });
      setShowAddTrainingForm(false);
      fetchTrainings(searchTerm, activeView);
    } catch (err) {
      console.error("Error adding training:", err);
      alert("Error adding training: " + err.message);
    }
  };

  const handleNewTrainingChange = (e) => {
    const { name, value } = e.target;
    setNewTraining(prev => ({ ...prev, [name]: value }));
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleRefineClick = () => {
    fetchTrainings(searchTerm, activeView);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    fetchTrainings('', activeView);
  };

  const handleDetailsClick = (trainingId) => {
    setVisiblePopupId(prev => (prev === trainingId ? null : trainingId));
  };

  const handleSidebarClick = (view) => {
    setActiveView(view);
    setSearchTerm('');
    fetchTrainings('', view);
    setIsSidebarOpen(false);
  };

  useEffect(() => {
    fetchTrainings(searchTerm, activeView);
  }, []);

  const getViewTitle = () => {
    switch (activeView) {
      case 'dashboard':
        return 'All Meetings';
      case 'upcoming':
        return 'Upcoming Meetings';
      case 'ongoing':
        return 'Ongoing Meetings';
      case 'overdue':
        return 'Overdue Meetings';
      default:
        return 'Meetings';
    }
  };


  return (
    <div className="dashboard-layout">
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <img src="/sasken_logo.png" alt="Sasken Logo" className="saskin-logo-small" />
          <span className="sidebar-brand-text">Sasken</span>
        </div>

        <nav className="sidebar-nav">
          <ul>
            <li className={activeView === 'dashboard' ? 'active' : ''} onClick={() => handleSidebarClick('dashboard')}>
              <span className="icon">🏠</span>
              <span className="text">Dashboard</span>
            </li>
            <li className={activeView === 'upcoming' ? 'active' : ''} onClick={() => handleSidebarClick('upcoming')}>
              <span className="icon">📅</span>
              <span className="text">Upcoming Trainings</span>
            </li>
            <li className={activeView === 'ongoing' ? 'active' : ''} onClick={() => handleSidebarClick('ongoing')}>
              <span className="icon">⏳</span>
              <span className="text">Ongoing Trainings</span>
            </li>
            <li className={activeView === 'overdue' ? 'active' : ''} onClick={() => handleSidebarClick('overdue')}>
              <span className="icon">⚠️</span>
              <span className="text">Overdue Trainings</span>
            </li>
          </ul>
        </nav>
      </aside>

      <div className={`main-content-area ${!isSidebarOpen ? 'sidebar-closed' : ''}`}>
        <header className="main-header">
          <button className="hamburger-menu" onClick={toggleSidebar}>
            ☰
          </button>

          <h1 className="page-title">Notification Engine</h1>

          <div className="header-right">
            <input
              type="text"
              placeholder="Search by title, trainer, or email..."
              className="header-search"
              value={searchTerm}
              onChange={handleSearchChange}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleRefineClick();
                }
              }}
            />
            <button className="search-icon" onClick={handleRefineClick}></button>
            {searchTerm && (
              <button className="clear-search-btn" onClick={handleClearSearch}>Clear</button>
            )}
            <img src="/user-avatar.jpg" alt="User" className="user-avatar" />
          </div>
        </header>

        <section className="dashboard-widgets">
          <h2 className="section-title meetings-dashboard-title">Meetings Dashboard</h2>

          <div className="upcoming-section">
            <div className="upcoming-header-row">
              <h3 className="section-subtitle">📅 {getViewTitle()}</h3>
              <div className="table-controls">
                <button className="add-training-btn" onClick={() => {
                  setShowAddTrainingForm(!showAddTrainingForm);
                  setShowRescheduleForm(false);
                }}>
                  {showAddTrainingForm ? 'Cancel Add' : 'Add Training'}
                </button>
                <button className="refine-btn" onClick={handleRefineClick}>Refine</button>
                <button className="reschedule-btn" onClick={handleRescheduleClick}>Reschedule</button>
                {selectedTrainingIds.length > 0 && (
                  <button
                    className="delete-selected-btn"
                    onClick={() => setShowDeleteModal(true)}
                    title="Delete Selected Trainings (Press Delete key)"
                  >
                    Delete Selected ({selectedTrainingIds.length})
                  </button>
                )}
              </div>
            </div>

            {showAddTrainingForm && (
              <div className="add-training-inline-form-container">
                <h3>Add New Training</h3>
                <form onSubmit={handleAddTraining} className="add-training-form">
                  <div className="form-row">
                    <label>Training Title:</label>
                    <input
                      type="text"
                      name="title"
                      placeholder="e.g., Spring Boot Advanced"
                      value={newTraining.title}
                      onChange={handleNewTrainingChange}
                      required
                    />
                  </div>
                  <div className="form-row">
                    <label>Trainer Name:</label>
                    <input
                      type="text"
                      name="trainerName"
                      placeholder="e.g., John Doe"
                      value={newTraining.trainerName}
                      onChange={handleNewTrainingChange}
                      required
                    />
                  </div>
                  <div className="form-row">
                    <label>Recipient Emails (comma-separated):</label>
                    <input
                      type="text"
                      name="userEmail"
                      placeholder="e.g., user1@example.com, user2@example.com"
                      value={newTraining.userEmail}
                      onChange={handleNewTrainingChange}
                      required
                    />
                  </div>
                  <div className="form-row">
                    <label>Due Date & Time:</label>
                    <input
                      type="datetime-local"
                      name="dueDate"
                      value={newTraining.dueDate}
                      onChange={handleNewTrainingChange}
                      required
                    />
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="add-training-btn">Add Training</button>
                  </div>
                </form>
              </div>
            )}

            {showRescheduleForm && (
              <div className="reschedule-training-inline-form-container add-training-inline-form-container">
                <h3>Reschedule Selected Training(s)</h3>
                <p className="selected-count">Rescheduling {selectedTrainingIds.length} training(s).</p>
                {selectedTrainingIds.length > 0 && (
                  <div className="reschedule-context">
                    <p><strong>First Selected Training:</strong></p>
                    <p>Title: {rescheduleData.title}</p>
                    <p>Trainer: {rescheduleData.trainerName}</p>
                    <p>Recipient(s): {rescheduleData.userEmail}</p>
                  </div>
                )}
                <form onSubmit={handleRescheduleSubmit} className="reschedule-training-form add-training-form">
                  <div className="form-row">
                    <label>New Due Date & Time:</label>
                    <input
                      type="datetime-local"
                      name="dueDate"
                      value={rescheduleData.dueDate}
                      onChange={handleRescheduleChange}
                      required
                    />
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="add-training-btn">Reschedule</button>
                    <button type="button" onClick={() => setShowRescheduleForm(false)} className="cancel-btn">Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {loading ? (
              <p>Loading training data...</p>
            ) : error ? (
              <p className="error-message">{error}</p>
            ) : trainings.length === 0 ? (
              <p>No trainings found for this view.</p>
            ) : (
              <table className="notification-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Title</th>
                    <th>Trainer</th>
                    <th>Notification Status</th>
                    <th>Details</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {trainings.map((training) => (
                    <tr key={training.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedTrainingIds.includes(training.id)}
                          onChange={() => handleCheckboxChange(training.id)}
                        />
                      </td>

                      <td>{training.date}</td>
                      <td>{training.time}</td>
                      <td>{training.title}</td>
                      <td>{training.trainerName}</td>
                      <td>
                        {/* ⭐ MODIFIED: Correct status-badge class and text ⭐ */}
                        <span className={`status-badge ${training.notificationStatus.toLowerCase()}`}>
                          {training.notificationStatus}
                        </span>
                      </td>
                      <td style={{ position: "relative" }}>
                        <button
                          className="view-details-btn"
                          onClick={() => handleDetailsClick(training.id)}
                        >
                          {visiblePopupId === training.id ? 'Close' : 'Details'}
                        </button>

                        {visiblePopupId === training.id && (
                          <div className="details-popup">
                            <strong>Title:</strong> {training.title}<br />
                            <strong>Trainer:</strong> {training.trainerName}<br />
                            <strong>Recipients:</strong> {training.userEmail}<br />
                            <strong>Scheduled:</strong> {training.date} at {training.time}<br />
                            <strong>Notifications:</strong>
                            <ul>
                              <li>2 Days Before: {training.notifiedTwoDaysBefore ? '✔️ Sent' : '❌ Pending'}</li>
                              <li>1 Day Before: {training.notifiedOneDayBefore ? '✔️ Sent' : '❌ Pending'}</li>
                              <li>1 Hour Before: {training.notifiedOneHourBefore ? '✔️ Sent' : '❌ Pending'}</li>
                              <li>30 Mins Before: {training.notifiedThirtyMinutesBefore ? '✔️ Sent' : '❌ Pending'}</li>
                            </ul>
                          </div>
                        )}
                      </td>
                      <td>
                        <button
                          className="send-now-btn"
                          onClick={() => handleSendNotification(training.id)}
                          disabled={
                            training.notificationStatus === 'Sent' ||
                            training.notificationStatus === 'Missed'
                          }
                        >
                          Send Now
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {showDeleteModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3>Confirm Delete</h3>
              <p>Are you sure you want to delete the selected trainings ({selectedTrainingIds.length})?</p>
              <div className="modal-actions">
                <button onClick={confirmDeleteSelectedTrainings} className="add-training-btn">Yes, Delete</button>
                <button onClick={() => setShowDeleteModal(false)} className="cancel-btn">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {showSuccessModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3>Success!</h3>
              <p>{successMessage}</p>
              <div className="modal-actions">
                <button onClick={() => setShowSuccessModal(false)} className="add-training-btn">OK</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;