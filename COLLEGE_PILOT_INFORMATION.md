# REUNITE — COLLEGE PILOT INFORMATION FORM

Please complete the fields in this document and return it to the REUNITE deployment coordinator before initiating the campus pilot.

> **CONFIDENTIALITY NOTICE:** Do **NOT** write actual passwords, private database credentials, or secret API keys in this document. All sensitive credentials must be set directly on the deployment server via environment variables.

---

## 1. INSTITUTION & ADMINISTRATIVE LEADS

* **College / University Name**: 
* **Campus Name / Location**: 
* **Primary Platform Administrator**: 
* **Administrator Email**: 
* **Administrator Phone**: 
* **IT / Technical Contact**: 
* **Technical Contact Email**: 
* **Target Pilot Start Date**: 
* **Target Student Cohort / Department(s)**: 

---

## 2. OFFICIAL CAMPUS STATIONS

List the initial physical collection stations that will participate in the pilot. Do not include simulated locations. Add more station blocks as needed.

### Station 1
* **Station Code** *(e.g., RNT-B1-F02-S01)*: 
* **Station Name / Type** *(e.g., CS Dept HOD Cabin / Reception Desk)*: 
* **Building Name / Code**: 
* **Floor Number / Level**: 
* **Specific Office / Cabin Identifier**: 
* **Walking Directions / Navigation Note**: 
* **Accepts Item Deposits from Students?** *(Yes / No)*: 
* **Performs Physical Verification & Handover?** *(Yes / No)*: 
* **Standard Operating Hours** *(e.g., Mon–Fri 09:00–17:00)*: 
* **Assigned Custodian / Staff Contact Name**: 
* **Assigned Custodian Staff Email**: 

### Station 2
* **Station Code**: 
* **Station Name / Type**: 
* **Building Name / Code**: 
* **Floor Number / Level**: 
* **Specific Office / Cabin Identifier**: 
* **Walking Directions / Navigation Note**: 
* **Accepts Item Deposits from Students?** *(Yes / No)*: 
* **Performs Physical Verification & Handover?** *(Yes / No)*: 
* **Standard Operating Hours**: 
* **Assigned Custodian / Staff Contact Name**: 
* **Assigned Custodian Staff Email**: 

### Station 3
* **Station Code**: 
* **Station Name / Type**: 
* **Building Name / Code**: 
* **Floor Number / Level**: 
* **Specific Office / Cabin Identifier**: 
* **Walking Directions / Navigation Note**: 
* **Accepts Item Deposits from Students?** *(Yes / No)*: 
* **Performs Physical Verification & Handover?** *(Yes / No)*: 
* **Standard Operating Hours**: 
* **Assigned Custodian / Staff Contact Name**: 
* **Assigned Custodian Staff Email**: 

---

## 3. INFRASTRUCTURE & HOSTING SPECIFICATIONS

* **Deployment Target** *(e.g., On-Premises VM / Institutional Cloud / Linux VPS)*: 
* **Host Operating System** *(e.g., Ubuntu 22.04 LTS)*: 
* **Public Domain / Web Address** *(e.g., reunite.campus.edu)*: 
* **Frontend Domain** *(if different from root)*: 
* **Backend API Domain** *(if different from root)*: 
* **Server IP Address**: 
* **HTTPS / SSL Certificate Available?** *(Yes / No)*: 
* **Certificate Provider** *(e.g., Let's Encrypt / Institutional Wildcard)*: 
* **PostgreSQL Server Host & Port** *(e.g., localhost:5432 or internal DB host)*: 
* **PostgreSQL Database Name** *(e.g., reunite_pilot_db)*: 
* **Persistent Media Storage Path** *(e.g., /var/reunite/media)*: 
* **Storage Backup Schedule** *(e.g., Daily automated snapshot)*: 

---

## 4. AI INTEGRATION

* **Google Gemini API Key Provisioned?** *(Yes / No)*: 
* **API Key Responsible Contact**: 

> **REMINDER:** Do **NOT** paste the Gemini API key in this form. Provide it directly to the server administrator for injection into the host `.env` file (`GEMINI_API_KEY`). If no key is available, REUNITE operates smoothly in manual description mode.

---

## 5. INSTITUTIONAL SIGN-OFF

* **Institutional Lead Signature / Approval**: 
* **Designation**: 
* **Date**: 
