const DB = (() => {
    const KEY = 'gym_data';

    function load() {
        const raw = localStorage.getItem(KEY);
        if (raw) return JSON.parse(raw);
        return {
            body_parts: [],
            muscles: [],
            exercises: [],
            records: [],
            training_muscles: [],
            training_exercises: [],
            muscle_exercises: [],
            next_ids: { body_parts: 1, muscles: 1, exercises: 1, records: 1 }
        };
    }

    function save(data) {
        localStorage.setItem(KEY, JSON.stringify(data));
    }

    function nextId(data, table) {
        const id = data.next_ids[table];
        data.next_ids[table]++;
        return id;
    }

    // ---- Body Parts (Entrenamientos) ----

    function getBodyParts() {
        return load().body_parts;
    }

    function createBodyPart(name) {
        const data = load();
        if (data.body_parts.find(bp => bp.name === name)) return null;
        const bp = { id: nextId(data, 'body_parts'), name };
        data.body_parts.push(bp);
        save(data);
        return bp;
    }

    function updateBodyPart(id, name) {
        const data = load();
        const bp = data.body_parts.find(bp => bp.id === id);
        if (bp) { bp.name = name; save(data); }
        return bp;
    }

    function deleteBodyPart(id) {
        const data = load();
        data.body_parts = data.body_parts.filter(bp => bp.id !== id);
        data.training_muscles = data.training_muscles.filter(tm => tm.training_id !== id);
        data.training_exercises = data.training_exercises.filter(te => te.training_id !== id);
        save(data);
    }

    // ---- Training Exercises ----

    function getTrainingExercises(trainingId) {
        const data = load();
        const rows = [];
        const tes = data.training_exercises.filter(te => te.training_id === trainingId);
        tes.forEach(te => {
            const exercise = data.exercises.find(e => e.id === te.exercise_id);
            const muscle = data.muscles.find(m => m.id === te.muscle_id);
            if (exercise && muscle) {
                const recs = data.records.filter(r => r.exercise_id === exercise.id);
                const maxWeight = recs.length ? Math.max(...recs.map(r => r.weight)) : 0;
                rows.push({ exercise, muscle, record_count: recs.length, max_weight: maxWeight });
            }
        });
        return rows;
    }

    function addMuscleToTraining(trainingId, muscleId) {
        const data = load();
        const exists = data.training_muscles.find(tm => tm.training_id === trainingId && tm.muscle_id === muscleId);
        if (!exists) {
            data.training_muscles.push({ training_id: trainingId, muscle_id: muscleId });
            save(data);
        }
    }

    function removeMuscleFromTraining(trainingId, muscleId) {
        const data = load();
        data.training_muscles = data.training_muscles.filter(tm => !(tm.training_id === trainingId && tm.muscle_id === muscleId));
        data.training_exercises = data.training_exercises.filter(te => !(te.training_id === trainingId && te.muscle_id === muscleId));
        save(data);
    }

    function addExerciseToTraining(trainingId, muscleId, exerciseId) {
        const data = load();
        const exists = data.training_exercises.find(te =>
            te.training_id === trainingId && te.muscle_id === muscleId && te.exercise_id === exerciseId);
        if (!exists) {
            data.training_exercises.push({ training_id: trainingId, muscle_id: muscleId, exercise_id: exerciseId });
            save(data);
        }
    }

    function removeExerciseFromTraining(trainingId, muscleId, exerciseId) {
        const data = load();
        data.training_exercises = data.training_exercises.filter(te =>
            !(te.training_id === trainingId && te.muscle_id === muscleId && te.exercise_id === exerciseId));
        save(data);
    }

    // ---- Muscles ----

    function getMuscles() {
        return load().muscles;
    }

    function createMuscle(name) {
        const data = load();
        let muscle = data.muscles.find(m => m.name.toLowerCase() === name.toLowerCase());
        if (!muscle) {
            muscle = { id: nextId(data, 'muscles'), name };
            data.muscles.push(muscle);
            save(data);
        }
        return muscle;
    }

    function getMuscleExercises(muscleId) {
        const data = load();
        const exerciseIds = data.muscle_exercises.filter(me => me.muscle_id === muscleId).map(me => me.exercise_id);
        return data.exercises.filter(e => exerciseIds.includes(e.id));
    }

    function addExerciseToMuscle(muscleId, exerciseId) {
        const data = load();
        const exists = data.muscle_exercises.find(me => me.muscle_id === muscleId && me.exercise_id === exerciseId);
        if (!exists) {
            data.muscle_exercises.push({ muscle_id: muscleId, exercise_id: exerciseId });
            save(data);
        }
    }

    // ---- Exercises ----

    function getExercises() {
        const data = load();
        return data.exercises.map(exercise => {
            const recs = data.records.filter(r => r.exercise_id === exercise.id);
            const maxWeight = recs.length ? Math.max(...recs.map(r => r.weight)) : 0;

            const muscleIds = data.muscle_exercises.filter(me => me.exercise_id === exercise.id).map(me => me.muscle_id);
            const muscles = data.muscles.filter(m => muscleIds.includes(m.id));

            const trainingIds = [...new Set(data.training_exercises.filter(te => te.exercise_id === exercise.id).map(te => te.training_id))];
            const trainings = data.body_parts.filter(bp => trainingIds.includes(bp.id));

            return {
                id: exercise.id,
                name: exercise.name,
                max_weight: maxWeight,
                record_count: recs.length,
                muscles,
                trainings
            };
        });
    }

    function createExercise(name) {
        const data = load();
        if (data.exercises.find(e => e.name === name)) return null;
        const exercise = { id: nextId(data, 'exercises'), name };
        data.exercises.push(exercise);
        save(data);
        return exercise;
    }

    function deleteExercise(id) {
        const data = load();
        data.exercises = data.exercises.filter(e => e.id !== id);
        data.records = data.records.filter(r => r.exercise_id !== id);
        data.muscle_exercises = data.muscle_exercises.filter(me => me.exercise_id !== id);
        data.training_exercises = data.training_exercises.filter(te => te.exercise_id !== id);
        save(data);
    }

    // ---- Records ----

    function getRecords(exerciseId) {
        const data = load();
        return data.records.filter(r => r.exercise_id === exerciseId).sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    function addRecord({ exercise_id, weight, reps, sets, notes }) {
        const data = load();
        const record = {
            id: nextId(data, 'records'),
            exercise_id,
            weight,
            reps,
            sets,
            date: new Date().toISOString(),
            notes: notes || ''
        };
        data.records.push(record);
        save(data);
        return record;
    }

    function deleteRecord(id) {
        const data = load();
        data.records = data.records.filter(r => r.id !== id);
        save(data);
    }

    function clearAll() {
        localStorage.removeItem(KEY);
    }

    return {
        getBodyParts, createBodyPart, updateBodyPart, deleteBodyPart,
        getTrainingExercises, addMuscleToTraining, removeMuscleFromTraining,
        addExerciseToTraining, removeExerciseFromTraining,
        getMuscles, createMuscle, getMuscleExercises, addExerciseToMuscle,
        getExercises, createExercise, deleteExercise,
        getRecords, addRecord, deleteRecord,
        clearAll
    };
})();
