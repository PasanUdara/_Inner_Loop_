const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8001/api").replace(/\/$/, "");

async function request(path, options = {}) {
	const response = await fetch(`${API_BASE_URL}${path}`, {
		credentials: "include",
		headers: { Accept: "application/json", "Content-Type": "application/json", ...(options.headers || {}) },
		...options,
	});

	if (!response.ok) {
		let message = `Request failed (${response.status})`;
		try {
			const body = await response.json();
			message = body.detail || message;
		} catch {
			// Keep the HTTP error when the response is not JSON.
		}
		throw new Error(message);
	}

	return response.status === 204 ? null : response.json();
}

export function listInternPods(projectId) {
	const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
	return request(`/intern-pods${query}`);
}

export function listInternPodMentors() {
	return request("/intern-pods/mentors");
}

export function listInternPodInterns() {
	return request("/intern-pods/interns");
}

export function createInternPod(payload) {
	return request("/intern-pods", { method: "POST", body: JSON.stringify(payload) });
}

export function updateInternPod(podId, payload) {
	return request(`/intern-pods/${podId}`, { method: "PUT", body: JSON.stringify(payload) });
}

export function deleteInternPod(podId) {
	return request(`/intern-pods/${podId}`, { method: "DELETE" });
}

export function addInternPodMember(podId, payload) {
	return request(`/intern-pods/${podId}/members`, { method: "POST", body: JSON.stringify(payload) });
}

export function deleteInternPodMember(podId, memberId) {
	return request(`/intern-pods/${podId}/members/${memberId}`, { method: "DELETE" });
}
