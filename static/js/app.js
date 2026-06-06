let currentTrainingId = null;
let libraryData = [];
let librarySort = { column: null, direction: 'asc' };

document.addEventListener('DOMContentLoaded', function() {
    initializeDarkMode();
    loadBodyParts();
    loadLibrary();

    const searchInput = document.getElementById('librarySearch');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            renderLibraryTable(filterLibraryData(libraryData, this.value));
        });
    }

    document.getElementById('trainings-tab').addEventListener('click', function() {
        loadBodyParts();
    });

    document.getElementById('library-tab').addEventListener('click', function() {
        setTimeout(() => loadLibrary(), 100);
    });
});

// ============ ENTRENAMIENTOS ============

function loadBodyParts() {
    const trainings = DB.getBodyParts();
    const container = document.getElementById('trainingsList');
    container.innerHTML = '';

    if (trainings.length === 0) {
        container.innerHTML = '<p class="text-muted text-center">Sin entrenamientos</p>';
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
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Sin ejercicios. Agrega un músculo para comenzar.</td></tr>`;
        return;
    }

    exercises.forEach(ex => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><a href="#" style="text-decoration: none; color: inherit; cursor: pointer;" onclick="event.preventDefault(); showExerciseStats(${ex.exercise.id})">${ex.exercise.name}</a></td>
            <td>${ex.muscle.name}</td>
            <td>${ex.record_count}</td>
            <td>${ex.max_weight} kg</td>
            <td><button class="btn btn-sm btn-danger" onclick="removeExerciseFromTraining(${trainingId}, ${ex.muscle.id}, ${ex.exercise.id})">Quitar</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function addBodyPart() {
    const name = document.getElementById('bodyPartName').value.trim();
    if (!name) { alert('Por favor ingresa un nombre'); return; }

    const result = DB.createBodyPart(name);
    if (!result) { alert('Error: Este entrenamiento ya existe'); return; }

    document.getElementById('bodyPartName').value = '';
    bootstrap.Modal.getInstance(document.getElementById('addBodyPartModal')).hide();
    loadBodyParts();
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
    if (!newName) { alert('Por favor ingresa un nombre'); return; }

    DB.updateBodyPart(window.editingBodyPartId, newName);
    bootstrap.Modal.getInstance(document.getElementById('editBodyPartModal')).hide();
    loadBodyParts();
}

function deleteBodyPart(id) {
    if (confirm('¿Eliminar este entrenamiento?')) {
        DB.deleteBodyPart(id);
        currentTrainingId = null;
        document.getElementById('trainingDetailContainer').style.display = 'none';
        document.getElementById('noTrainingSelected').style.display = 'block';
        loadBodyParts();
    }
}

function showAddMuscleToTrainingModal() {
    const muscles = DB.getMuscles();
    const muscleSelect = document.getElementById('muscleSelectTraining');
    muscleSelect.innerHTML = '<option value="">Selecciona un músculo...</option>';

    muscles.forEach(muscle => {
        const option = document.createElement('option');
        option.value = muscle.id;
        option.textContent = muscle.name;
        muscleSelect.appendChild(option);
    });

    muscleSelect.onchange = function() {
        if (this.value) {
            goToExerciseSelection(parseInt(this.value), this.options[this.selectedIndex].text);
        }
    };

    document.getElementById('step-muscle').style.display = 'block';
    document.getElementById('step-exercise').style.display = 'none';
    document.getElementById('trainingModalTitle').textContent = 'Agregar Ejercicio';

    const modal = new bootstrap.Modal(document.getElementById('addExerciseToTrainingModal'));
    modal.show();
}

function goToExerciseSelection(muscleId, muscleName) {
    window.selectedMuscleInTraining = { id: muscleId, name: muscleName };

    DB.addMuscleToTraining(currentTrainingId, muscleId);

    const available = DB.getMuscleExercises(muscleId);
    const assigned = DB.getTrainingExercises(currentTrainingId);
    const assignedIds = new Set(assigned.filter(r => r.muscle.id === muscleId).map(r => r.exercise.id));

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
    if (!exerciseId) { alert('Por favor selecciona un ejercicio'); return; }
    if (!currentTrainingId || !window.selectedMuscleInTraining) { alert('Error: selecciona un entrenamiento y un músculo primero'); return; }

    DB.addExerciseToTraining(currentTrainingId, window.selectedMuscleInTraining.id, exerciseId);
    bootstrap.Modal.getInstance(document.getElementById('addExerciseToTrainingModal')).hide();
    loadTrainingExercises(currentTrainingId);
}

function removeExerciseFromTraining(trainingId, muscleId, exerciseId) {
    if (confirm('¿Quitar este ejercicio?')) {
        DB.removeExerciseFromTraining(trainingId, muscleId, exerciseId);
        loadTrainingExercises(trainingId);
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
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No hay resultados</td></tr>`;
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

function showExerciseStats(exerciseId) {
    window.currentExerciseId = exerciseId;

    const records = DB.getRecords(exerciseId);
    const exerciseData = libraryData.find(row => row.exerciseId === exerciseId);

    let exerciseName = exerciseData ? exerciseData.exerciseName : 'Ejercicio';
    let maxWeight = records.length ? Math.max(...records.map(r => r.weight)) : 0;

    if (!exerciseData) {
        const exercises = DB.getExercises();
        const ex = exercises.find(e => e.id === exerciseId);
        if (ex) { exerciseName = ex.name; maxWeight = ex.max_weight; }
    }

    document.getElementById('exerciseStatsTitle').textContent = exerciseName;
    document.getElementById('statsMaxWeight').textContent = maxWeight + ' kg';
    document.getElementById('statsRecordCount').textContent = records.length;

    const historialHtml = records.length > 0
        ? records.slice().reverse().map(r => {
            const volume = (r.weight * r.reps * r.sets).toFixed(0);
            return `
                <div class="record-row">
                    <div class="record-info">
                        <div><strong>${r.weight} kg</strong> × ${r.reps} reps × ${r.sets} series | Vol: ${volume} kg</div>
                        <div class="record-date">${new Date(r.date).toLocaleDateString('es-ES')} ${new Date(r.date).toLocaleTimeString('es-ES', {hour: '2-digit', minute: '2-digit'})}</div>
                        ${r.notes ? `<div class="text-muted"><small>${r.notes}</small></div>` : ''}
                    </div>
                    <button class="btn btn-sm btn-danger" onclick="deleteRecord(${r.id})">×</button>
                </div>
            `;
        }).join('')
        : '<p class="text-muted">Sin registros</p>';

    document.getElementById('statsHistorial').innerHTML = historialHtml;

    const canvas = document.getElementById('statsChart');
    if (records.length > 0) {
        canvas.style.display = 'block';
        drawStatsChart(records);
    } else {
        canvas.style.display = 'none';
    }

    const modal = new bootstrap.Modal(document.getElementById('exerciseStatsModal'));
    modal.show();
}

function addRecord() {
    const weight = document.getElementById('recordWeight').value;
    const reps = document.getElementById('recordReps').value;
    const sets = document.getElementById('recordSets').value;
    const notes = document.getElementById('recordNotes').value;

    if (!weight || !reps || !sets) { alert('Por favor completa peso, reps y series'); return; }

    DB.addRecord({
        exercise_id: window.currentExerciseId,
        weight: parseFloat(weight),
        reps: parseInt(reps),
        sets: parseInt(sets),
        notes
    });

    document.getElementById('recordWeight').value = '';
    document.getElementById('recordReps').value = '';
    document.getElementById('recordSets').value = '';
    document.getElementById('recordNotes').value = '';

    showExerciseStats(window.currentExerciseId);
}

function deleteRecord(recordId) {
    if (confirm('¿Eliminar este registro?')) {
        DB.deleteRecord(recordId);
        showExerciseStats(window.currentExerciseId);
    }
}

function drawStatsChart(records) {
    const sorted = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
    const ctx = document.getElementById('statsChart').getContext('2d');

    if (window.statsChartInstance) window.statsChartInstance.destroy();

    window.statsChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sorted.map(r => new Date(r.date).toLocaleDateString('es-ES')),
            datasets: [{
                label: 'Peso (kg)',
                data: sorted.map(r => r.weight),
                borderColor: '#0d6efd',
                backgroundColor: 'rgba(13, 110, 253, 0.1)',
                tension: 0.3,
                fill: true,
                pointBackgroundColor: '#0d6efd',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true, position: 'top' } },
            scales: { y: { beginAtZero: false } }
        }
    });
}

function addExerciseWithMuscle() {
    const exerciseName = document.getElementById('exerciseNameInput').value.trim();
    const muscleName = document.getElementById('muscleNameInput').value.trim();

    if (!exerciseName || !muscleName) { alert('Por favor completa ambos campos'); return; }

    const muscle = DB.createMuscle(muscleName.charAt(0).toUpperCase() + muscleName.slice(1).toLowerCase());
    const exercise = DB.createExercise(exerciseName);

    if (!exercise) { alert('Error: Este ejercicio ya existe'); return; }

    DB.addExerciseToMuscle(muscle.id, exercise.id);

    document.getElementById('exerciseNameInput').value = '';
    document.getElementById('muscleNameInput').value = '';
    bootstrap.Modal.getInstance(document.getElementById('addExerciseWithMuscleModal')).hide();

    loadLibrary();
}

function deleteExerciseLibrary(exerciseId) {
    if (confirm('¿Eliminar este ejercicio?')) {
        DB.deleteExercise(exerciseId);
        loadLibrary();
        loadBodyParts();
    }
}

// ============ CONFIGURACIÓN ============

function showClearDatabaseConfirm() {
    if (confirm('⚠️ ADVERTENCIA: Esto eliminará TODA la base de datos. ¿Estás seguro?')) {
        if (confirm('Última oportunidad. ¿Confirmas que quieres borrar todo?')) {
            const userInput = prompt('Escribe ELIMINAR para confirmar:');
            if (userInput === 'ELIMINAR') {
                DB.clearAll();
                window.location.reload();
            } else {
                alert('Operación cancelada.');
            }
        }
    }
}

function exportData() {
    const data = localStorage.getItem('gym_data') || '{}';
    const pretty = JSON.stringify(JSON.parse(data), null, 2);
    document.getElementById('exportText').value = pretty;
    new bootstrap.Modal(document.getElementById('exportModal')).show();
}

function copyExportData() {
    const textarea = document.getElementById('exportText');
    textarea.select();
    navigator.clipboard.writeText(textarea.value).then(() => {
        alert('Datos copiados al portapapeles.');
    }).catch(() => {
        textarea.select();
        document.execCommand('copy');
        alert('Datos copiados al portapapeles.');
    });
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            JSON.parse(e.target.result); // validar que es JSON válido
            if (confirm('¿Importar datos? Esto reemplazará todos los datos actuales.')) {
                localStorage.setItem('gym_data', e.target.result);
                alert('Datos importados correctamente.');
                window.location.reload();
            }
        } catch {
            alert('Error: el archivo no es válido.');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
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
