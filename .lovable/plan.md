

# Fix Missing VSD/BOPM Columns & Add Role-Based People Dropdowns

## Problem
1. **VSD column** exists only as a text field/filter but is not a staffable role slot in the deal table
2. **BOPM roles** (Principal BOPM, Senior BOPM, BOPM) are completely missing from the role definitions and deal table
3. Role assignment uses a free-form person selection instead of dropdowns filtered by role from the People Sheet data

## What Changes

### 1. Add Missing Roles to `staffingData.ts`

Add these role slots to `ROLE_SLOTS` (inserted before Content roles):
- `vsd` — VSD (category: "Operations")
- `principal_bopm` — Principal BOPM (category: "Operations")
- `senior_bopm` — Senior BOPM (category: "Operations")
- `bopm` — BOPM (category: "Operations")

Add "Operations" to `ROLE_CATEGORIES`.

### 2. Populate Complete People Data from People Sheet

Add all people from the People Sheet (Page 5 of the spreadsheet) including:
- **VSDs**: Aamir Khan, Aditya Shaw, Neema Jayadas, Sneha Iyer, Sumit Shekhawat
- **Principal BOPMs**: Anita Raghav, Atharva Thorve, Rableen Kaur, Harpreet Kapoor, Sumitha Shetty, Sushmita B., Tushar Walia, Nishtha Kanal, Ritu Shinde, Romario Fernandes, Vrusha Mawani, Shreshtha Phatak, Devanshi Panibhate, Eshika Joshi, Ajitesh Pandey, etc.
- **Senior BOPMs**: Anisha Jaisinghani, Ayushi Das, Disha Suratwala, Janhavi Trivedi, Karna Shah, Maleeha Mukhtar, Rahul Singh, Rishabh Agarwal, Tiffany Fernandes, Vanshika Khandelia, Venkatesh Durgam, Vivek Teotia, Mitchelle, Sanchit Arora, Nivedita Shetty, Preet Desai, etc.
- **BOPMs**: Aman Jain, Anshika Sharma, Chaitanya Sharma, Disha Bhanushali, Eshika Joshi, Hasan Kothawalaa, Jeneel Narodia, Karishma Sawlani, Khushi Rajpurohit, Mansi Velani, etc.

Also add any missing people from other roles (new SEO people like Vaibhav Sawant, Manav Shah, Sanket Mahure, Vivek Chaudhary, Shahid Anwar, Nitish Singh, Pranav Jha, Crasto Leo Raymant; new Creative people like Zigyasa Tryoon, Ansh Bhansali, Barbie Duggal, Pratyush Singh, Antara Joshi, Dhruti Lalan, Preksha Tamra, Ria Itagi, Ananya Goradia, Dhwanai Lath, Vinaya Chindarkar, Anjali Goel, Kashish Jain, Nihar A Patade, Jigar Somani, Prasad Thete, Avnish Khandelwal, etc.).

### 3. Role-Filtered Dropdowns in Staffing Modal

Update the "Staff" modal in `Staffing.tsx`:
- When clicking "Staff" on a role column, filter the people dropdown to only show people whose `roleCategory` matches that column's category AND whose `roleTitle` matches or is compatible with that role
- Create a mapping: `ROLE_TO_PEOPLE_FILTER` that maps each `roleKey` to the matching `roleTitle` values
- The dropdown shows: person name + current utilization % so the user can see bandwidth before assigning

### 4. Pre-populate VSD & BOPM Assignments

Add staffing assignments for VSD and BOPM roles based on the spreadsheet data. The VSD column already has names in `deal.vsd` — these become proper `StaffingAssignment` entries. BOPM assignments will be mapped from the People Sheet cross-reference data.

### Files Modified
- `src/data/staffingData.ts` — Add Operations roles, ~60 new people, BOPM/VSD assignments
- `src/pages/Staffing.tsx` — Add role-filtered dropdown logic in the staff modal, ensure Operations category appears first

