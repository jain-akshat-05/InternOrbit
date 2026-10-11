import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/axios";
import Icon from "../components/Icon";

const ROUND_TYPES = [
  ["resume_screening", "Resume screening"],
  ["online_assessment", "Online assessment"],
  ["technical_interview", "Technical interview"],
  ["hr_interview", "HR interview"],
  ["final_decision", "Final decision"],
  ["custom", "Custom round"],
];

const OUTCOMES = ["pending", "passed", "failed", "not_attended"];
const emptyRound = { title: "", type: "custom", description: "", scheduledAt: "", instructions: "", meetingUrl: "", order: 0, published: false };

const toLocalDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

export default function RecruiterRounds() {
  const { internshipId } = useParams();
  const [rounds, setRounds] = useState([]);
  const [applications, setApplications] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedRoundId, setSelectedRoundId] = useState("");
  const [selectedApplications, setSelectedApplications] = useState([]);
  const [roundForm, setRoundForm] = useState(emptyRound);
  const [resultForms, setResultForms] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [roundResponse, applicationResponse] = await Promise.all([
        api.get(`/rounds/internship/${internshipId}`),
        api.get("/applications/received", { params: { internshipId } }),
      ]);
      setRounds(roundResponse.data);
      setApplications(applicationResponse.data);
      if (selectedRoundId && !roundResponse.data.some((round) => round._id === selectedRoundId)) {
        setSelectedRoundId("");
        setRoundForm(emptyRound);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Could not load hiring rounds.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [internshipId]);

  useEffect(() => {
    if (!selectedRoundId) {
      setAssignments([]);
      return;
    }
    let active = true;
    api.get(`/rounds/${selectedRoundId}/assignments`)
      .then(({ data }) => {
        if (!active) return;
        setAssignments(data);
        setResultForms(Object.fromEntries(data.map((assignment) => [assignment._id, {
          outcome: assignment.outcome,
          privateFeedback: assignment.privateFeedback || "",
          resultPublished: assignment.resultPublished,
        }])));
      })
      .catch((err) => { if (active) setError(err.response?.data?.message || "Could not load assigned candidates."); });
    return () => { active = false; };
  }, [selectedRoundId]);

  const selectRound = (round) => {
    setSelectedRoundId(round._id);
    setRoundForm({
      title: round.title,
      type: round.type,
      description: round.description || "",
      scheduledAt: toLocalDateTime(round.scheduledAt),
      instructions: round.instructions || "",
      meetingUrl: round.meetingUrl || "",
      order: round.order || 0,
      published: round.published,
    });
    setSelectedApplications([]);
    setError("");
    setSuccess("");
  };

  const resetRound = () => {
    setSelectedRoundId("");
    setRoundForm(emptyRound);
    setSelectedApplications([]);
    setAssignments([]);
  };

  const saveRound = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    const payload = {
      ...roundForm,
      scheduledAt: roundForm.scheduledAt ? new Date(roundForm.scheduledAt).toISOString() : null,
    };
    try {
      if (selectedRoundId) {
        await api.put(`/rounds/${selectedRoundId}`, payload);
        setSuccess("Round updated.");
      } else {
        const { data } = await api.post("/rounds", { ...payload, internshipId });
        setSelectedRoundId(data._id);
        setSuccess("Round created.");
      }
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save this round.");
    } finally {
      setSaving(false);
    }
  };

  const assignCandidates = async () => {
    if (!selectedRoundId || selectedApplications.length === 0) return;
    setSaving(true);
    setError("");
    try {
      await api.post(`/rounds/${selectedRoundId}/assign`, { applicationIds: selectedApplications });
      setSuccess("Candidates assigned to this round.");
      setSelectedApplications([]);
      const { data } = await api.get(`/rounds/${selectedRoundId}/assignments`);
      setAssignments(data);
      setResultForms(Object.fromEntries(data.map((assignment) => [assignment._id, {
        outcome: assignment.outcome,
        privateFeedback: assignment.privateFeedback || "",
        resultPublished: assignment.resultPublished,
      }])));
    } catch (err) {
      setError(err.response?.data?.message || "Could not assign candidates.");
    } finally {
      setSaving(false);
    }
  };

  const saveResult = async (assignment) => {
    const form = resultForms[assignment._id];
    setSaving(true);
    setError("");
    try {
      await api.put(`/rounds/${selectedRoundId}/results/${assignment.applicationId}`, form);
      setSuccess("Round outcome saved.");
      const { data } = await api.get(`/rounds/${selectedRoundId}/assignments`);
      setAssignments(data);
    } catch (err) {
      setError(err.response?.data?.message || "Could not save this candidate outcome.");
    } finally {
      setSaving(false);
    }
  };

  const deleteRound = async () => {
    if (!selectedRoundId || assignments.length > 0) return;
    if (!window.confirm("Remove this round? This action cannot be undone.")) return;
    setSaving(true);
    setError("");
    try {
      await api.delete(`/rounds/${selectedRoundId}`);
      resetRound();
      setSuccess("Round removed.");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not remove this round.");
    } finally {
      setSaving(false);
    }
  };

  if (loading && rounds.length === 0) return <div className="page"><p>Loading hiring rounds...</p></div>;

  return (
    <div className="page rounds-page">
      <Link className="back-link" to="/recruiter">← Recruiter dashboard</Link>
      <div className="dashboard-heading"><div><span className="eyebrow">RECRUITMENT PIPELINE</span><h2>Hiring rounds</h2></div><span className="result-count">{applications.length} applicants</span></div>
      {error && <p className="error" role="alert">{error}</p>}
      {success && <p className="success" role="status">{success}</p>}

      <div className="rounds-layout">
        <section className="profile-section round-list-section">
          <div className="section-heading-compact"><div><span className="eyebrow">STAGES</span><h3>Internship rounds</h3></div><button type="button" className="button-quiet" onClick={resetRound}>New round</button></div>
          {rounds.length === 0 ? <p className="muted">No rounds configured. Create a round to begin coordinating candidates.</p> : (
            <ol className="round-list">
              {rounds.map((round, index) => (
                <li key={round._id}>
                  <span className="round-order">{index + 1}</span>
                  <button type="button" className={`round-select${selectedRoundId === round._id ? " is-selected" : ""}`} onClick={() => selectRound(round)}>
                    <strong>{round.title}</strong><span>{ROUND_TYPES.find(([type]) => type === round.type)?.[1] || "Round"}</span>
                  </button>
                  <span className={`badge ${round.published ? "badge-active" : "badge-neutral"}`}>{round.published ? "Published" : "Draft"}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="profile-section round-editor-section">
          <div className="section-heading-compact"><div><span className="eyebrow">ROUND DETAILS</span><h3>{selectedRoundId ? "Edit round" : "Create round"}</h3></div></div>
          <form className="profile-fields" onSubmit={saveRound}>
            <label>Round title<input aria-label="Round title" required maxLength={120} value={roundForm.title} onChange={(event) => setRoundForm((current) => ({ ...current, title: event.target.value }))} /></label>
            <label>Round type<select aria-label="Round type" value={roundForm.type} onChange={(event) => setRoundForm((current) => ({ ...current, type: event.target.value }))}>{ROUND_TYPES.map(([type, label]) => <option value={type} key={type}>{label}</option>)}</select></label>
            <label>Schedule<input aria-label="Round schedule" type="datetime-local" value={roundForm.scheduledAt} onChange={(event) => setRoundForm((current) => ({ ...current, scheduledAt: event.target.value }))} /></label>
            <label>Meeting or assessment URL<input aria-label="Meeting or assessment URL" type="url" value={roundForm.meetingUrl} onChange={(event) => setRoundForm((current) => ({ ...current, meetingUrl: event.target.value }))} /></label>
            <label className="profile-field-wide">Description<textarea aria-label="Round description" maxLength={2000} value={roundForm.description} onChange={(event) => setRoundForm((current) => ({ ...current, description: event.target.value }))} /></label>
            <label className="profile-field-wide">Candidate instructions<textarea aria-label="Candidate instructions" maxLength={4000} value={roundForm.instructions} onChange={(event) => setRoundForm((current) => ({ ...current, instructions: event.target.value }))} /></label>
            <label>Order<input aria-label="Round order" type="number" min="0" max="1000" value={roundForm.order} onChange={(event) => setRoundForm((current) => ({ ...current, order: Number(event.target.value) }))} /></label>
            <label className="checkbox-label"><input type="checkbox" checked={roundForm.published} onChange={(event) => setRoundForm((current) => ({ ...current, published: event.target.checked }))} /> Publish schedule and instructions to assigned candidates</label>
            <div className="round-form-actions"><button type="submit" disabled={saving}>{saving ? "Saving..." : selectedRoundId ? "Save round" : "Create round"}</button>{selectedRoundId && <button type="button" className="button-quiet" disabled={saving || assignments.length > 0} onClick={deleteRound}>Remove round</button>}</div>
          </form>
        </section>
      </div>

      {selectedRoundId && (
        <section className="profile-section round-candidates-section">
          <div className="section-heading-compact"><div><span className="eyebrow">CANDIDATE SELECTION</span><h3>Assign applicants</h3></div></div>
          {applications.filter((application) => !["rejected", "withdrawn"].includes(application.status)).length === 0 ? <p className="muted">No eligible applicants for this internship yet.</p> : (
            <div className="candidate-checklist">
              {applications.filter((application) => !["rejected", "withdrawn"].includes(application.status)).map((application) => (
                <label className="candidate-check" key={application._id}>
                  <input type="checkbox" checked={selectedApplications.includes(application._id)} onChange={(event) => setSelectedApplications((current) => event.target.checked ? [...new Set([...current, application._id])] : current.filter((id) => id !== application._id))} />
                  <span><strong>{application.student?.name || "Student"}</strong><small>{application.internship?.title} · {application.status}</small></span>
                  <Link to={`/applications/${application._id}`} onClick={(event) => event.stopPropagation()}>Review</Link>
                </label>
              ))}
            </div>
          )}
          <button type="button" disabled={saving || selectedApplications.length === 0} onClick={assignCandidates}>Assign selected candidates</button>
          <h3>Assigned candidates ({assignments.length})</h3>
          {assignments.length === 0 ? <p className="muted">No candidates assigned to this round.</p> : (
            <div className="round-assignment-list">
              {assignments.map((assignment) => {
                const form = resultForms[assignment._id] || { outcome: assignment.outcome, privateFeedback: assignment.privateFeedback, resultPublished: assignment.resultPublished };
                return (
                  <article className="round-assignment-card" key={assignment._id}>
                    <div><strong>{assignment.student?.name || "Student"}</strong><p className="muted">{assignment.student?.email} · {assignment.applicationStatus}</p></div>
                    <label>Outcome<select value={form.outcome} onChange={(event) => setResultForms((current) => ({ ...current, [assignment._id]: { ...form, outcome: event.target.value } }))}>{OUTCOMES.map((outcome) => <option key={outcome} value={outcome}>{outcome.replaceAll("_", " ")}</option>)}</select></label>
                    <label>Private recruiter feedback<textarea value={form.privateFeedback} onChange={(event) => setResultForms((current) => ({ ...current, [assignment._id]: { ...form, privateFeedback: event.target.value } }))} maxLength={4000} /></label>
                    <label className="checkbox-label"><input type="checkbox" checked={form.resultPublished} onChange={(event) => setResultForms((current) => ({ ...current, [assignment._id]: { ...form, resultPublished: event.target.checked } }))} /> Publish result to candidate</label>
                    <button type="button" disabled={saving} onClick={() => saveResult(assignment)}>Save candidate result</button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}