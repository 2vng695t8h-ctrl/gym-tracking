let currentTrainingId = null;
let libraryData = [];
let librarySort = { column: null, direction: 'asc' };
let activeModal = null;

function formatDate(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function closeAllModals() {
    const modals = document.querySelectorAll('.modal.show');
    modals.forEach(m => {
        const instance = bootstrap.Modal.getInstance(m);
        if (instance) instance.hide();
    });
    activeModal = null;
}

document.addEventListener('DOMContentLoaded', function() {
    initializeDarkMode();
    loadBodyParts();
    loadLibrary();
    loadSessions();

    const searchInput = document.getElementById('librarySearch');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            renderLibraryTable(filterLibraryData(libraryData, this.value));
        });
    }

    const trainingsTab = document.getElementById('trainings-tab');
    if (trainingsTab) trainingsTab.addEventListener('click', function() {
        loadBodyParts();
    });

    const libraryTab = document.getElementById('library-tab');
    if (libraryTab) libraryTab.addEventListener('click', function() {
        setTimeout(() => loadLibrary(), 100);
    });

    const historyTab = document.getElementById('history-tab');
    if (historyTab) historyTab.addEventListener('click', function() {
        setTimeout(() => loadSessions(), 100);
    });
});

// ============ ENTRENAMIENTOS ============

function loadBodyParts() {
    const trainings = DB.getBodyParts();
    const container = document.getElementById('trainingsList');
    container.innerHTML = '';

    if (trainings.length === 0) {
        container.innerHTML = '<p class="text-muted text-center">No trainings</p>';
        return;
    }

    trainings.forEach(training => {
        const div = document.createElement('div');
        div.className = 'training-item';
        div.onclick = () => selectTraining(training.id, training.name);
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong>${training.name}</strong>
                <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteBodyPart(${training.id})">×</button>
            </div>
        `;
        div.onmouseover = () => div.classList.add('training-item-hover');
        div.onmouseout = () => div.classList.remove('training-item-hover');
        container.appendChild(div);
    });
}

function selectTraining(trainingId, trainingName) {
    currentTrainingId = trainingId;
    document.getElementById('noTrainingSelected').style.display = 'none';
    document.getElementById('trainingDetailContainer').style.display = 'block';
    loadTrainingExercises(trainingId);
}

function loadTrainingExercises(trainingId) {
    const exercises = DB.getTrainingExercises(trainingId);
    const tbody = document.getElementById('trainingTable');
    tbody.innerHTML = '';

    if (exercises.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No exercises. Add a muscle to start.</td></tr>';
        return;
    }

    exercises.forEach(ex => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><a href="#" style="text-decoration: none; color: inherit; cursor: pointer;" onclick="event.preventDefault(); showExerciseStats(${ex.exercise.id})">${ex.exercise.name}</a></td>
            <td>${ex.muscle ? ex.muscle.name : '—'}</td>
            <td>${ex.record_count}</td>
            <td>${ex.max_weight} kg</td>
            <td><button class="btn btn-sm btn-danger" onclick="removeExerciseFromTraining(${trainingId}, ${ex.exercise.id})">Quitar</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function addBodyPart() {
    const name = document.getElementById('bodyPartName').value.trim();
    if (!name) { alert('Please enter a name'); return; }

    const result = DB.createBodyPart(name);
    if (!result) { alert('Error: This training already exists'); return; }

    document.getElementById('bodyPartName').value = '';
    closeAllModals();
    setTimeout(() => loadBodyParts(), 100);
}

function showEditBodyPartModal(event, bodyPartId, bodyPartName) {
    event.stopPropagation();
    window.editingBodyPartId = bodyPartId;
    document.getElementById('editBodyPartName').value = bodyPartName;
    const modal = new bootstrap.Modal(document.getElementById('editBodyPartModal'));
    modal.show();
}

function saveBodyPartName() {
    const newName = document.getElementById('editBodyPartName').value.trim();
    if (!newName) { alert('Please enter a name'); return; }

    DB.updateBodyPart(window.editingBodyPartId, newName);
    closeAllModals();
    setTimeout(() => loadBodyParts(), 100);
}

function deleteBodyPart(id) {
    if (confirm('Delete this training?')) {
        DB.deleteBodyPart(id);
        currentTrainingId = null;
        document.getElementById('trainingDetailContainer').style.display = 'none';
        document.getElementById('noTrainingSelected').style.display = 'block';
        setTimeout(() => loadBodyParts(), 100);
    }
}

function showAddMuscleToTrainingModal() {
    const muscles = DB.getMuscles();
    const muscleSelect = document.getElementById('muscleSelectTraining');
    muscleSelect.innerHTML = '<option value="">Select a muscle...</option>';

    muscles.forEach(muscle => {
        const option = document.createElement('option');
        option.value = muscle.id;
        option.textContent = muscle.name;
        muscleSelect.appendChild(option);
    });

    muscleSelect.removeEventListener('change', window.muscleSelectHandler);
    window.muscleSelectHandler = function() {
        if (this.value) {
            goToExerciseSelection(parseInt(this.value), this.options[this.selectedIndex].text);
        }
    };
    muscleSelect.addEventListener('change', window.muscleSelectHandler);

    document.getElementById('step-muscle').style.display = 'block';
    document.getElementById('step-exercise').style.display = 'none';
    document.getElementById('trainingModalTitle').textContent = 'Agregar Ejercicio';

    const modal = new bootstrap.Modal(document.getElementById('addExerciseToTrainingModal'));
    modal.show();
}

function goToExerciseSelection(muscleId, muscleName) {
    window.selectedMuscleInTraining = { id: muscleId, name: muscleName };

    const available = DB.getMuscleExercises(muscleId);
    const assigned = DB.getTrainingExercises(currentTrainingId);
    const assignedIds = new Set(assigned.map(r => r.exercise.id));

    const exerciseSelect = document.getElementById('exerciseSelectTraining');
    exerciseSelect.innerHTML = '<option value="">Selecciona un ejercicio...</option>';

    available.filter(e => !assignedIds.has(e.id)).forEach(exercise => {
        const option = document.createElement('option');
        option.value = exercise.id;
        option.textContent = exercise.name;
        exerciseSelect.appendChild(option);
    });

    document.getElementById('step-muscle').style.display = 'none';
    document.getElementById('step-exercise').style.display = 'block';
    document.getElementById('trainingModalTitle').textContent = `Selecciona ejercicio de ${muscleName}`;
}

function goBackToMuscleSelection() {
    document.getElementById('step-muscle').style.display = 'block';
    document.getElementById('step-exercise').style.display = 'none';
    document.getElementById('trainingModalTitle').textContent = 'Agregar Ejercicio';
    document.getElementById('muscleSelectTraining').value = '';
}

function addExerciseToTrainingConfirm() {
    const exerciseId = parseInt(document.getElementById('exerciseSelectTraining').value);
    if (!exerciseId) { alert('Please select an exercise'); return; }
    if (!currentTrainingId) { alert('Error: select a training first'); return; }

    DB.addExerciseToTraining(currentTrainingId, exerciseId);
    closeAllModals();
    setTimeout(() => loadTrainingExercises(currentTrainingId), 100);
}

function removeExerciseFromTraining(trainingId, exerciseId) {
    if (confirm('Remove this exercise?')) {
        DB.removeExerciseFromTraining(trainingId, exerciseId);
        setTimeout(() => loadTrainingExercises(trainingId), 100);
    }
}

// ============ BIBLIOTECA ============

function loadLibrary() {
    const exercises = DB.getExercises();
    libraryData = [];

    exercises.forEach(exercise => {
        const trainingNames = exercise.trainings.map(t => t.name).join(', ') || '—';

        if (exercise.muscles.length === 0) {
            libraryData.push({ exerciseId: exercise.id, exerciseName: exercise.name, muscleName: null, recordCount: exercise.record_count, maxWeight: exercise.max_weight, trainings: trainingNames, isMainRow: true });
        } else {
            exercise.muscles.forEach((muscle, idx) => {
                libraryData.push({ exerciseId: exercise.id, exerciseName: exercise.name, muscleName: muscle.name, recordCount: exercise.record_count, maxWeight: exercise.max_weight, trainings: trainingNames, isMainRow: idx === 0 });
            });
        }
    });

    renderLibraryTable(libraryData);
}

function filterLibraryData(data, searchTerm) {
    if (!searchTerm.trim()) return data;
    const search = searchTerm.toLowerCase();
    return data.filter(row =>
        row.exerciseName.toLowerCase().includes(search) ||
        (row.muscleName && row.muscleName.toLowerCase().includes(search))
    );
}

function sortLibraryBy(column) {
    if (librarySort.column === column) {
        librarySort.direction = librarySort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        librarySort.column = column;
        librarySort.direction = 'asc';
    }

    let sortedData = [...libraryData].sort((a, b) => {
        let aVal, bVal;
        switch(column) {
            case 'exercise': aVal = a.exerciseName.toLowerCase(); bVal = b.exerciseName.toLowerCase(); break;
            case 'muscle': aVal = (a.muscleName || '').toLowerCase(); bVal = (b.muscleName || '').toLowerCase(); break;
            case 'records': aVal = a.recordCount; bVal = b.recordCount; break;
            case 'weight': aVal = a.maxWeight; bVal = b.maxWeight; break;
            default: return 0;
        }
        if (typeof aVal === 'string') return librarySort.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        return librarySort.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });

    document.querySelectorAll('thead th span').forEach(span => span.textContent = '');
    const sortIcon = document.getElementById(`sort-${column}`);
    if (sortIcon) sortIcon.textContent = librarySort.direction === 'asc' ? ' ▲' : ' ▼';

    renderLibraryTable(sortedData);
}

function renderLibraryTable(data) {
    const tbody = document.getElementById('libraryTable');
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No results</td></tr>';
        return;
    }

    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="cursor: pointer;" onclick="showExerciseStats(${row.exerciseId})">${row.isMainRow ? `<strong>${row.exerciseName}</strong>` : ''}</td>
            <td>${row.muscleName || '<span class="text-muted">—</span>'}</td>
            <td><small>${row.trainings}</small></td>
            <td>${row.isMainRow ? row.recordCount : ''}</td>
            <td>${row.isMainRow ? row.maxWeight + ' kg' : ''}</td>
            <td>${row.isMainRow ? `<button class="btn btn-sm btn-danger" onclick="deleteExerciseLibrary(${row.exerciseId})">Eliminar</button>` : ''}</td>
        `;
        tbody.appendChild(tr);
    });
}

function getSessionRecords(exerciseId) {
    const sessions = DB.getSessions();
    const records = [];

    sessions.forEach(session => {
        if (session.exercises) {
            session.exercises.forEach(ex => {
                if (ex.exercise_id === exerciseId) {
                    if (ex.series && ex.series.length > 0) {
                        ex.series.forEach((serie, idx) => {
                            if (serie.weight > 0 || serie.reps > 0) {
                                records.push({
                                    id: `${session.id}-${ex.exercise_id}-${idx}`,
                                    exercise_id: exerciseId,
                                    weight: serie.weight,
                                    reps: serie.reps,
                                    sets: 1,
                                    date: session.date,
                                    notes: ''
                                });
                            }
                        });
                    }
                }
            });
        }
    });

    return records.sort((a, b) => new Date(a.date) - new Date(b.date));
}

function showExerciseStats(exerciseId) {
    window.currentExerciseId = exerciseId;

    const records = getSessionRecords(exerciseId);
    const exerciseData = libraryData.find(row => row.exerciseId === exerciseId);

    let exerciseName = exerciseData ? exerciseData.exerciseName : 'Ejercicio';
    let totalVolume = records.reduce((sum, r) => sum + (r.weight * r.reps * r.sets), 0);

    if (!exerciseData) {
        const exercises = DB.getExercises();
        const ex = exercises.find(e => e.id === exerciseId);
        if (ex) { exerciseName = ex.name; }
    }

    document.getElementById('exerciseStatsTitle').textContent = exerciseName;
    document.getElementById('statsMaxWeight').textContent = Math.round(totalVolume) + ' kg (vol)';
    document.getElementById('statsRecordCount').textContent = records.length;

    // Group records by date and collect series
    const volumeByDate = {};
    records.forEach(r => {
        const dateKey = formatDate(r.date);
        if (!volumeByDate[dateKey]) {
            volumeByDate[dateKey] = { date: r.date, volume: 0, maxWeight: 0, series: [] };
        }
        const serieVolume = r.weight * r.reps * r.sets;
        volumeByDate[dateKey].volume += serieVolume;
        volumeByDate[dateKey].maxWeight = Math.max(volumeByDate[dateKey].maxWeight, r.weight);
        volumeByDate[dateKey].series.push(serieVolume);
    });

    const byDate = Object.values(volumeByDate).sort((a, b) => new Date(a.date) - new Date(b.date));

    // Filter to show only when volume or max weight changed
    const filtered = [];
    let lastVolume = null;
    let lastMaxWeight = null;

    byDate.forEach(d => {
        if (lastVolume === null || d.volume !== lastVolume || d.maxWeight !== lastMaxWeight) {
            filtered.push(d);
            lastVolume = d.volume;
            lastMaxWeight = d.maxWeight;
        }
    });

    // History (newest first) — uses the exact same filtered points as the chart
    const historialHtml = filtered.length > 0
        ? [...filtered].reverse().map(d => {
            const seriesStr = d.series.map(v => Math.round(v)).join(' + ');
            return `
                <div class="record-row">
                    <div class="record-info">
                        <div><strong>${Math.round(d.volume)} kg</strong> (${seriesStr}) | Max Weight: ${d.maxWeight}kg</div>
                        <div class="record-date">${formatDate(d.date)}</div>
                    </div>
                </div>
            `;
        }).join('')
        : '<p class="text-muted">No records</p>';

    document.getElementById('statsHistorial').innerHTML = historialHtml;

    const canvas = document.getElementById('statsChart');
    if (filtered.length > 0) {
        canvas.style.display = 'block';
        drawStatsChart(filtered);
    } else {
        canvas.style.display = 'none';
    }

    const modal = new bootstrap.Modal(document.getElementById('exerciseStatsModal'));
    modal.show();
}



// Receives the already-filtered points (oldest first) shared with the History,
// so every chart point matches exactly one History entry.
function drawStatsChart(points) {
    const ctx = document.getElementById('statsChart');
    if (!ctx) return;

    if (window.statsChartInstance) window.statsChartInstance.destroy();

    const isMobile = window.innerWidth < 768;
    const pointRadius = isMobile ? 3 : 5;
    const pointHoverRadius = isMobile ? 5 : 7;

    window.statsChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: points.map(d => formatDate(d.date)),
            datasets: [
                {
                    label: 'Volumen Total (kg)',
                    data: points.map(d => Math.round(d.volume)),
                    borderColor: '#0d6efd',
                    backgroundColor: 'rgba(13, 110, 253, 0.1)',
                    tension: 0.3,
                    fill: true,
                    pointBackgroundColor: '#0d6efd',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius,
                    pointHoverRadius,
                    yAxisID: 'yVolume'
                },
                {
                    label: 'Max Weight (kg)',
                    data: points.map(d => d.maxWeight),
                    borderColor: '#dc3545',
                    backgroundColor: 'rgba(220, 53, 69, 0.1)',
                    tension: 0.3,
                    fill: false,
                    pointBackgroundColor: '#dc3545',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius,
                    pointHoverRadius,
                    yAxisID: 'yWeight'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true, position: 'top' } },
            scales: {
                yVolume: {
                    type: 'linear',
                    position: 'left',
                    beginAtZero: false,
                    title: { display: !isMobile, text: 'Volumen (kg)' }
                },
                yWeight: {
                    type: 'linear',
                    position: 'right',
                    beginAtZero: false,
                    grid: { drawOnChartArea: false },
                    title: { display: !isMobile, text: 'Max Weight (kg)' }
                }
            }
        }
    });
}

function addExerciseWithMuscle() {
    const exerciseName = document.getElementById('exerciseNameInput').value.trim();
    const muscleName = document.getElementById('muscleNameInput').value.trim();

    if (!exerciseName || !muscleName) { alert('Please fill all fields'); return; }

    const muscle = DB.createMuscle(muscleName.charAt(0).toUpperCase() + muscleName.slice(1).toLowerCase());
    const exercise = DB.createExercise(exerciseName);

    if (!exercise) { alert('Error: This exercise already exists'); return; }

    DB.addExerciseToMuscle(muscle.id, exercise.id);

    document.getElementById('exerciseNameInput').value = '';
    document.getElementById('muscleNameInput').value = '';
    closeAllModals();
    setTimeout(() => loadLibrary(), 100);
}

function deleteExerciseLibrary(exerciseId) {
    if (confirm('Delete this exercise?')) {
        DB.deleteExercise(exerciseId);
        setTimeout(() => {
            loadLibrary();
            loadBodyParts();
        }, 100);
    }
}

// ============ CONFIGURACIÓN ============

function showClearDatabaseConfirm() {
    if (confirm('WARNING: This will delete ALL database. Are you sure?')) {
        if (confirm('Last chance. Do you confirm you want to delete everything?')) {
            const userInput = prompt('Type DELETE to confirm:');
            if (userInput === 'DELETE') {
                DB.clearAll();
                window.location.reload();
            } else {
                alert('Operation canceled.');
            }
        }
    }
}

function exportData() {
    const data = localStorage.getItem('gym_data') || '{}';
    const pretty = JSON.stringify(JSON.parse(data), null, 2);
    const blob = new Blob([pretty], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gym-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

function copyExportData() {
    const textarea = document.getElementById('exportText');
    textarea.select();
    navigator.clipboard.writeText(textarea.value).then(() => {
        alert('Data copied to clipboard.');
    }).catch(() => {
        textarea.select();
        document.execCommand('copy');
        alert('Data copied to clipboard.');
    });
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            JSON.parse(e.target.result);
            if (confirm('Import data? This will replace all current data.')) {
                localStorage.setItem('gym_data', e.target.result);
                alert('Data imported successfully.');
                window.location.reload();
            }
        } catch {
            alert('Error: the file is not valid.');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// ============ HISTORIAL DE SESIONES ============

function loadSessions() {
    const sessions = DB.getSessions();
    const container = document.getElementById('sessionsContainer');
    if (!container) return;

    container.innerHTML = '';

    if (sessions.length === 0) {
        container.innerHTML = '<div class="alert alert-info">No sessions recorded</div>';
        return;
    }

    // Group sessions by month
    const sessionsByMonth = {};
    sessions.forEach(session => {
        const date = new Date(session.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!sessionsByMonth[monthKey]) {
            sessionsByMonth[monthKey] = [];
        }
        sessionsByMonth[monthKey].push(session);
    });

    const months = Object.keys(sessionsByMonth).sort().reverse();
    let currentMonthIndex = window.currentSessionMonthIndex !== undefined ? window.currentSessionMonthIndex : 0;
    // Clamp index in case sessions were deleted and the month no longer exists
    if (currentMonthIndex > months.length - 1) currentMonthIndex = months.length - 1;
    if (currentMonthIndex < 0) currentMonthIndex = 0;
    const currentMonth = months[currentMonthIndex];
    window.currentSessionMonthIndex = currentMonthIndex;

    // Create month navigator
    const [year, monthNum] = currentMonth.split('-');
    const monthName = new Date(year, parseInt(monthNum) - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const navHtml = `<div style="display: flex; gap: 12px; margin-bottom: 16px; align-items: center; justify-content: center;">
        <button class="btn btn-sm btn-outline-primary" onclick="previousSessionMonth()" ${currentMonthIndex === months.length - 1 ? 'disabled' : ''}>← Previous</button>
        <div style="min-width: 150px; text-align: center; font-weight: 500;">${monthName}</div>
        <button class="btn btn-sm btn-outline-primary" onclick="nextSessionMonth()" ${currentMonthIndex === 0 ? 'disabled' : ''}>Next →</button>
    </div>`;

    container.innerHTML = navHtml;

    const sessionsDiv = document.createElement('div');
    sessionsDiv.id = 'sessions-list';
    container.appendChild(sessionsDiv);

    renderSessionsForMonth(currentMonth);
}

function getSessionMonths() {
    const sessions = DB.getSessions();
    const sessionsByMonth = {};
    sessions.forEach(session => {
        const date = new Date(session.date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!sessionsByMonth[key]) sessionsByMonth[key] = [];
        sessionsByMonth[key].push(session);
    });
    return Object.keys(sessionsByMonth).sort().reverse();
}

function nextSessionMonth() {
    const currentIndex = window.currentSessionMonthIndex || 0;
    if (currentIndex > 0) {
        window.currentSessionMonthIndex = currentIndex - 1;
        loadSessions();
    }
}

function previousSessionMonth() {
    const months = getSessionMonths();
    const currentIndex = window.currentSessionMonthIndex || 0;
    if (currentIndex < months.length - 1) {
        window.currentSessionMonthIndex = currentIndex + 1;
        loadSessions();
    }
}

function renderSessionsForMonth(monthKey) {
    const sessions = DB.getSessions();
    const container = document.getElementById('sessions-list');
    container.innerHTML = '';

    const sessionsByMonth = {};
    sessions.forEach(session => {
        const date = new Date(session.date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!sessionsByMonth[key]) {
            sessionsByMonth[key] = [];
        }
        sessionsByMonth[key].push(session);
    });

    const monthSessions = (sessionsByMonth[monthKey] || []).slice().reverse();

    monthSessions.forEach(session => {
        const date = formatDate(session.date);
        const training = DB.getBodyPartById(session.training_id);
        const trainingName = training ? training.name : 'Unknown training';

        const div = document.createElement('div');
        div.className = 'session-card';
        div.style.cursor = 'pointer';

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.onclick = () => toggleSession(session.id);

        header.innerHTML = `
            <div style="display: flex; gap: 12px; align-items: center; flex: 1;">
                <span id="arrow-${session.id}" style="font-size: 18px;">▶</span>
                <div>
                    <strong>${trainingName}</strong>
                    <small style="margin-left: 12px; color: #999;">${date}</small>
                </div>
            </div>
            <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteSession(${session.id})">×</button>
        `;

        div.appendChild(header);

        const content = document.createElement('div');
        content.id = `session-content-${session.id}`;
        content.style.display = 'none';
        content.style.marginTop = '12px';
        content.style.paddingTop = '12px';
        content.style.borderTop = '1px solid #ddd';

        div.appendChild(content);
        container.appendChild(div);

        const exerciseDiv = document.getElementById(`session-content-${session.id}`);
        if (session.exercises && session.exercises.length > 0) {
            let html = '';
            session.exercises.forEach((ex, exIdx) => {
                const exercise = DB.getExerciseById(ex.exercise_id);
                const exerciseName = exercise ? exercise.name : 'Unknown exercise';

                html += `<div class="exercise-series">
                    <small><strong>${exerciseName}</strong></small>
                    <div id="series-${session.id}-${exIdx}">`;

                if (ex.series && ex.series.length > 0) {
                    ex.series.forEach((s, serieIdx) => {
                        html += `<div class="serie-row">
                            <small style="min-width: 35px;">Set ${serieIdx + 1}:</small>
                            <div style="display: flex; gap: 2px; align-items: center;">
                                <input type="number" class="form-control form-control-sm" style="width: 50px;" placeholder="0" value="${s.weight}" data-session="${session.id}" data-exercise="${exIdx}" data-serie="${serieIdx}" data-field="weight">
                                <small style="min-width: 20px;">kg</small>
                            </div>
                            <div style="display: flex; gap: 2px; align-items: center;">
                                <input type="number" class="form-control form-control-sm" style="width: 50px;" placeholder="0" value="${s.reps}" data-session="${session.id}" data-exercise="${exIdx}" data-serie="${serieIdx}" data-field="reps">
                                <small style="min-width: 35px;">reps</small>
                            </div>
                            <button class="btn btn-sm btn-danger" onclick="deleteSerieFromSession(${session.id}, ${exIdx}, ${serieIdx})">×</button>
                        </div>`;
                    });
                } else {
                    html += `<small class="text-muted">No series</small>`;
                }

                html += `</div>
                    <button class="btn btn-sm btn-outline-primary mt-2" onclick="addSerieToSession(${session.id}, ${exIdx})">+ Add set</button>
                </div>`;
            });
            html += `<button class="btn btn-sm btn-success mt-2" onclick="saveSessionChanges(${session.id})">Save</button>`;
            exerciseDiv.innerHTML = html;
        }
    });
}

function saveSession() {
    if (!currentTrainingId) {
        alert('Please select a training first in the Trainings tab');
        return;
    }

    const exercises = DB.getTrainingExercises(currentTrainingId);
    if (exercises.length === 0) {
        alert('The selected training has no exercises');
        return;
    }

    try {
        // Get last session of this training to copy weights
        const allSessions = DB.getSessions();
        const lastSession = allSessions
            .filter(s => s.training_id === currentTrainingId)
            .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

        const session = DB.addSession({
            training_id: currentTrainingId,
            exercises: exercises.map(ex => {
                let series = [];

                // If there's a previous session, copy all series
                if (lastSession && lastSession.exercises) {
                    const prevExercise = lastSession.exercises.find(e => e.exercise_id === ex.exercise.id);
                    if (prevExercise && prevExercise.series && prevExercise.series.length > 0) {
                        // Copy all series from previous session
                        series = JSON.parse(JSON.stringify(prevExercise.series));
                    }
                }

                return {
                    exercise_id: ex.exercise.id,
                    series: series
                };
            })
        });

        if (session) {
            alert('Session saved successfully');
            setTimeout(() => loadSessions(), 100);
        } else {
            alert('Error saving session');
        }
    } catch (error) {
        alert('Error: ' + error.message);
        console.error('Save session error:', error);
    }
}

// Reads the current values typed in the session's inputs (which may be unsaved)
// and returns the exercises array with those values applied. This prevents
// losing edits when adding/removing a set before pressing Save.
function readSessionExercisesFromDOM(sessionId) {
    const sessions = DB.getSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return null;

    const updatedExercises = JSON.parse(JSON.stringify(session.exercises));
    const inputs = document.querySelectorAll(`input[data-session="${sessionId}"]`);

    inputs.forEach(input => {
        const exerciseIdx = parseInt(input.dataset.exercise);
        const serieIdx = parseInt(input.dataset.serie);
        const field = input.dataset.field;
        const value = parseFloat(input.value) || 0;

        if (updatedExercises[exerciseIdx] && updatedExercises[exerciseIdx].series[serieIdx]) {
            updatedExercises[exerciseIdx].series[serieIdx][field] = value;
        }
    });

    return updatedExercises;
}

function addSerieToSession(sessionId, exerciseIdx) {
    const exercises = readSessionExercisesFromDOM(sessionId);
    if (!exercises || !exercises[exerciseIdx]) return;

    if (!exercises[exerciseIdx].series) {
        exercises[exerciseIdx].series = [];
    }

    // Add new serie with 0 weight and reps
    exercises[exerciseIdx].series.push({ weight: 0, reps: 0 });
    DB.updateSession(sessionId, exercises);

    // Refresh only this session's display without collapsing
    updateSessionDisplay(sessionId);
}

function deleteSerieFromSession(sessionId, exerciseIdx, serieIdx) {
    if (!confirm('Delete this set?')) return;

    const exercises = readSessionExercisesFromDOM(sessionId);
    if (!exercises || !exercises[exerciseIdx]) return;

    exercises[exerciseIdx].series.splice(serieIdx, 1);
    DB.updateSession(sessionId, exercises);
    updateSessionDisplay(sessionId);
}

function updateSessionDisplay(sessionId) {
    const sessions = DB.getSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    const exerciseDiv = document.getElementById(`session-content-${sessionId}`);
    if (!exerciseDiv) return;

    if (session.exercises && session.exercises.length > 0) {
        let html = '';
        session.exercises.forEach((ex, exIdx) => {
            const exercise = DB.getExerciseById(ex.exercise_id);
            const exerciseName = exercise ? exercise.name : 'Unknown exercise';

            html += `<div class="exercise-series">
                <small><strong>${exerciseName}</strong></small>
                <div id="series-${sessionId}-${exIdx}">`;

            if (ex.series && ex.series.length > 0) {
                ex.series.forEach((s, serieIdx) => {
                    html += `<div class="serie-row">
                        <small style="min-width: 35px;">Set ${serieIdx + 1}:</small>
                        <div style="display: flex; gap: 2px; align-items: center;">
                            <input type="number" class="form-control form-control-sm" style="width: 50px;" placeholder="0" value="${s.weight}" data-session="${sessionId}" data-exercise="${exIdx}" data-serie="${serieIdx}" data-field="weight">
                            <small style="min-width: 20px;">kg</small>
                        </div>
                        <div style="display: flex; gap: 2px; align-items: center;">
                            <input type="number" class="form-control form-control-sm" style="width: 50px;" placeholder="0" value="${s.reps}" data-session="${sessionId}" data-exercise="${exIdx}" data-serie="${serieIdx}" data-field="reps">
                            <small style="min-width: 35px;">reps</small>
                        </div>
                        <button class="btn btn-sm btn-danger" onclick="deleteSerieFromSession(${sessionId}, ${exIdx}, ${serieIdx})">×</button>
                    </div>`;
                });
            } else {
                html += `<small class="text-muted">No series</small>`;
            }

            html += `</div>
                <button class="btn btn-sm btn-outline-primary mt-2" onclick="addSerieToSession(${sessionId}, ${exIdx})">+ Add set</button>
            </div>`;
        });
        html += `<button class="btn btn-sm btn-success mt-2" onclick="saveSessionChanges(${sessionId})">Save</button>`;
        exerciseDiv.innerHTML = html;
    }
}

function toggleSession(sessionId) {
    const content = document.getElementById(`session-content-${sessionId}`);
    const arrow = document.getElementById(`arrow-${sessionId}`);

    if (content.style.display === 'none') {
        content.style.display = 'block';
        arrow.textContent = '▼';
    } else {
        content.style.display = 'none';
        arrow.textContent = '▶';
    }
}

function saveSessionChanges(sessionId) {
    const updatedExercises = readSessionExercisesFromDOM(sessionId);
    if (!updatedExercises) return;

    DB.updateSession(sessionId, updatedExercises);
    alert('Session updated');
    setTimeout(() => loadSessions(), 100);
}

function deleteSession(sessionId) {
    if (confirm('Delete this session?')) {
        DB.deleteSession(sessionId);
        setTimeout(() => loadSessions(), 100);
    }
}

function initializeDarkMode() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    const toggle = document.getElementById('darkModeToggle');
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        toggle.checked = true;
    }
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
}
