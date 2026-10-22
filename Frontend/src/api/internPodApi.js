import { apiRequest } from "./authApi";

export function listInternPods(projectId) {
	const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
	return apiRequest(`/intern-pods${query}`);
}

export function listInternPodMentors() {
	return apiRequest("/intern-pods/mentors");
}

export function listInternPodInterns() {
	return apiRequest("/intern-pods/interns");
}

export function createInternPod(payload) {
	return apiRequest("/intern-pods", { method: "POST", body: JSON.stringify(payload) });
}

export function updateInternPod(podId, payload) {
	return apiRequest(`/intern-pods/${podId}`, { method: "PUT", body: JSON.stringify(payload) });
}

export function deleteInternPod(podId) {
	return apiRequest(`/intern-pods/${podId}`, { method: "DELETE" });
}

export function addInternPodMember(podId, payload) {
	return apiRequest(`/intern-pods/${podId}/members`, { method: "POST", body: JSON.stringify(payload) });
}

export function deleteInternPodMember(podId, memberId) {
	return apiRequest(`/intern-pods/${podId}/members/${memberId}`, { method: "DELETE" });
}
