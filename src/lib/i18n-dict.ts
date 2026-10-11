// Hindi for the labels that appear everywhere (menus, headings, buttons, table headers, filters).
// English text is the key; anything not listed simply stays in English. Add a line to translate more -
// the text must match exactly as it is shown on screen.
export const HI: Record<string, string> = {
  // ── menus & sections ──
  'Dashboard': 'डैशबोर्ड', 'Main': 'मुख्य', 'Modules': 'मॉड्यूल', 'Recruitment': 'भर्ती', 'Candidate Pool': 'उम्मीदवार सूची',
  'Organization': 'संगठन', 'Org Chart': 'संगठन चार्ट', 'Reporting Structure': 'रिपोर्टिंग ढांचा',
  'Employee Management': 'कर्मचारी प्रबंधन', 'Manage Employees': 'कर्मचारी प्रबंधन', 'Pending Approvals': 'लंबित स्वीकृतियाँ',
  'Document Approvals': 'दस्तावेज़ स्वीकृति', 'Leave Management': 'छुट्टी प्रबंधन', 'WFH Management': 'वर्क फ्रॉम होम प्रबंधन',
  'Attendance': 'उपस्थिति', 'Upload Attendance': 'उपस्थिति अपलोड', 'Attendance Summary': 'उपस्थिति सारांश', 'Daily Records': 'दैनिक रिकॉर्ड',
  'Corrections': 'सुधार अनुरोध', 'Templates': 'टेम्पलेट', 'Payroll': 'वेतन', 'Salary Structures': 'वेतन संरचना', 'Salary Sheet': 'वेतन शीट',
  'Generate Payslips': 'वेतन पर्ची बनाएँ', 'Payslip History': 'वेतन पर्ची इतिहास', 'Reports': 'रिपोर्ट', 'Assets': 'संपत्ति', 'Asset Types': 'संपत्ति के प्रकार',
  'Communications': 'संचार', 'Email Log': 'ईमेल लॉग', 'Draft Emails': 'ईमेल ड्राफ्ट', 'Employee Credentials': 'कर्मचारी लॉगिन विवरण',
  'System': 'सिस्टम', 'Audit Log': 'ऑडिट लॉग', 'Backup & Export': 'बैकअप और एक्सपोर्ट', 'System Masters': 'सिस्टम मास्टर',
  'Departments': 'विभाग', 'Designations': 'पदनाम', 'Settings': 'सेटिंग्स', 'Notifications': 'सूचनाएँ', 'Back to Dashboard': 'डैशबोर्ड पर वापस',
  'My Profile': 'मेरी प्रोफ़ाइल', 'Change Password': 'पासवर्ड बदलें', 'Logout': 'लॉग आउट', 'Preferences': 'पसंद', 'My Preferences': 'मेरी पसंद',
  'My Payslips': 'मेरी वेतन पर्ची', 'Documents': 'दस्तावेज़', 'Leave Requests': 'छुट्टी अनुरोध', 'Work From Home': 'वर्क फ्रॉम होम', 'Contact HR': 'एचआर से संपर्क',
  'Employee Portal': 'कर्मचारी पोर्टल', 'Notification': 'सूचना',
  // ── page titles ──
  'Employee Profile': 'कर्मचारी प्रोफ़ाइल', 'Attendance Corrections': 'उपस्थिति सुधार', 'Daily Attendance Records': 'दैनिक उपस्थिति रिकॉर्ड',
  'Update Employee Attendance': 'कर्मचारी उपस्थिति अपडेट', 'Salary Structure': 'वेतन संरचना', 'Invite Employee': 'कर्मचारी को आमंत्रित करें',
  'Pending Approval': 'लंबित स्वीकृति', 'Backup & Export ': 'बैकअप और एक्सपोर्ट', 'Reports ': 'रिपोर्ट', 'Organization Chart': 'संगठन चार्ट',
  'Company Settings': 'कंपनी सेटिंग्स', 'Holiday Calendar': 'अवकाश कैलेंडर', 'Status Master': 'स्टेटस मास्टर', 'Leave Calendar': 'छुट्टी कैलेंडर',
  'Recent Activities': 'हाल की गतिविधियाँ', 'Leave Trends': 'छुट्टी रुझान', 'Upcoming Birthdays': 'आने वाले जन्मदिन', 'Birthdays': 'जन्मदिन',
  'Work Anniversaries': 'कार्य वर्षगाँठ', 'Upcoming Holidays': 'आने वाली छुट्टियाँ', 'Needs Your Attention': 'आपके ध्यान की ज़रूरत',
  'Upcoming Interviews': 'आने वाले इंटरव्यू', 'Hiring Pipeline': 'भर्ती प्रक्रिया', 'Out of Office Today': 'आज ऑफिस से बाहर', 'New Hires': 'नए कर्मचारी',
  'Headcount by Department': 'विभाग के अनुसार कर्मचारी', 'Attendance Overview': 'उपस्थिति अवलोकन', 'Today': 'आज', "Today's Attendance": 'आज की उपस्थिति',
  // ── dashboard cards ──
  'Total Employees': 'कुल कर्मचारी', 'Present Today': 'आज उपस्थित', 'On Leave': 'छुट्टी पर', 'Open Requests': 'खुले अनुरोध', 'Total Candidates': 'कुल उम्मीदवार',
  'Awaiting your review': 'आपकी समीक्षा बाकी', 'Approved leave today': 'आज स्वीकृत छुट्टी', 'Active departments': 'सक्रिय विभाग', 'All registered candidates': 'सभी पंजीकृत उम्मीदवार',
  // ── buttons & actions ──
  'Save': 'सेव करें', 'Save Settings': 'सेटिंग्स सेव करें', 'Cancel': 'रद्द करें', 'Close': 'बंद करें', 'Submit': 'जमा करें', 'Search': 'खोजें', 'Reset': 'रीसेट',
  'Refresh': 'रीफ़्रेश', 'Refresh now': 'अभी रीफ़्रेश करें', '⟳ Refresh now': '⟳ अभी रीफ़्रेश करें', 'Filter': 'फ़िल्टर', 'Apply': 'लागू करें', 'Add': 'जोड़ें', 'Edit': 'संपादित करें', 'Delete': 'हटाएँ',
  'View': 'देखें', 'View all': 'सभी देखें', 'Details': 'विवरण', 'Back': 'वापस', '← Back': '← वापस', 'Approve': 'स्वीकृत करें', 'Reject': 'अस्वीकार करें', 'Approved': 'स्वीकृत', 'Rejected': 'अस्वीकृत',
  'Pending': 'लंबित', 'Update': 'अपडेट', 'Download': 'डाउनलोड', 'Export': 'एक्सपोर्ट', 'Export Excel': 'एक्सेल एक्सपोर्ट', 'Export PDF': 'पीडीएफ एक्सपोर्ट', 'Import from Excel': 'एक्सेल से इम्पोर्ट',
  'Add Employee': 'कर्मचारी जोड़ें', 'Add Candidate': 'उम्मीदवार जोड़ें', '+ Add asset': '+ संपत्ति जोड़ें', 'More actions': 'और कार्य', 'Run report': 'रिपोर्ट चलाएँ', 'Generate Payroll': 'वेतन तैयार करें',
  'Assign': 'सौंपें', 'Return': 'वापस लें', 'History': 'इतिहास', 'Send to HR': 'एचआर को भेजें', 'Request correction': 'सुधार का अनुरोध', 'Send': 'भेजें', 'Verify': 'सत्यापित करें', 'Verify All': 'सभी सत्यापित करें',
  'Approve & email all drafts': 'सभी ड्राफ्ट स्वीकृत करें और ईमेल भेजें', 'Save compulsory documents': 'अनिवार्य दस्तावेज़ सेव करें', 'Create Invite': 'आमंत्रण बनाएँ',
  'Download full backup': 'पूरा बैकअप डाउनलोड करें', 'Download Excel': 'एक्सेल डाउनलोड करें', 'Next': 'अगला', 'Previous': 'पिछला', 'Prev': 'पिछला',
  // ── filters & fields ──
  'All': 'सभी', 'All Status': 'सभी स्थिति', 'All Departments': 'सभी विभाग', 'All Types': 'सभी प्रकार', 'All Months': 'सभी महीने', 'All Years': 'सभी वर्ष', 'Status': 'स्थिति', 'Department': 'विभाग',
  'Designation': 'पदनाम', 'Employee': 'कर्मचारी', 'Employee ID': 'कर्मचारी आईडी', 'Emp Code': 'कर्मचारी कोड', 'Name': 'नाम', 'Email': 'ईमेल', 'Mobile': 'मोबाइल', 'Phone': 'फ़ोन',
  'Joined': 'जुड़ने की तिथि', 'Joining Date': 'जुड़ने की तिथि', 'Date': 'तारीख', 'From': 'से', 'To': 'तक', 'Day': 'दिन', 'Type': 'प्रकार', 'Reason': 'कारण', 'Actions': 'कार्य', 'Action': 'कार्य',
  'Month': 'महीना', 'Year': 'वर्ष', 'Days': 'दिन', 'Total': 'कुल', 'Active': 'सक्रिय', 'Inactive': 'निष्क्रिय', 'Invited': 'आमंत्रित', 'Dropped': 'छोड़ा', 'Needs Correction': 'सुधार आवश्यक',
  'Employee Name': 'कर्मचारी का नाम', 'Applied': 'आवेदन', 'Applied On': 'आवेदन तिथि', 'Duration': 'अवधि', 'Leave Type': 'छुट्टी का प्रकार', 'Date Range': 'तारीख सीमा',
  // ── attendance ──
  'Present': 'उपस्थित', 'Absent': 'अनुपस्थित', 'Half Day': 'आधा दिन', 'Week Off': 'साप्ताहिक अवकाश', 'Holiday': 'छुट्टी', 'Extra Work': 'अतिरिक्त कार्य', 'Not checked in': 'चेक-इन नहीं',
  'Check In': 'चेक इन', 'Check Out': 'चेक आउट', 'Total Hours': 'कुल घंटे', 'Working Hours': 'कार्य घंटे', 'Working Hrs': 'कार्य घंटे', 'IN Time': 'आने का समय', 'OUT Time': 'जाने का समय',
  'Monthly Records': 'मासिक रिकॉर्ड', 'Punch History': 'पंच इतिहास', 'Overview': 'अवलोकन', 'Status key:': 'स्थिति संकेत:', 'My requests': 'मेरे अनुरोध', 'Missed a punch?': 'पंच छूट गया?',
  'Date of correction': 'सुधार की तारीख', 'In time': 'आने का समय', 'Out time': 'जाने का समय',
  // ── leave & tabs ──
  'All Requests': 'सभी अनुरोध', 'Pending Approval ': 'लंबित स्वीकृति', 'Calendar View': 'कैलेंडर दृश्य', 'Rejected ': 'अस्वीकृत', 'Today ': 'आज',
  // ── payroll ──
  'Month Days': 'महीने के दिन', 'Paid Days': 'भुगतान दिन', 'UnPaid Days': 'बिना भुगतान दिन', 'PerDay Salary': 'प्रतिदिन वेतन', 'Net Payable': 'देय राशि', 'Insurance': 'बीमा',
  'Gross Salary': 'सकल वेतन', 'Deductions': 'कटौतियाँ', 'Net Salary': 'शुद्ध वेतन', 'Draft': 'ड्राफ्ट', 'Drafts': 'ड्राफ्ट', 'Basic': 'मूल वेतन', 'Total Payroll': 'कुल वेतन', 'Average Salary': 'औसत वेतन',
  'Total Deductions': 'कुल कटौतियाँ', 'Final Salary': 'अंतिम वेतन', 'Generated Date': 'बनाने की तारीख',
  // ── assets / reports / misc ──
  'Available': 'उपलब्ध', 'Assigned': 'सौंपा गया', 'In repair': 'मरम्मत में', 'Lost': 'खोया', 'Retired': 'सेवानिवृत्त', 'Tag': 'टैग', 'Asset': 'संपत्ति', 'Serial': 'सीरियल', 'With': 'किसके पास', 'Since': 'कब से',
  'Attrition': 'कर्मचारी छोड़ने की दर', 'Headcount': 'कर्मचारी संख्या', 'Leave': 'छुट्टी', 'This month': 'इस महीने', 'Last month': 'पिछला महीना', 'Last 3 months': 'पिछले 3 महीने', 'This financial year': 'इस वित्त वर्ष',
  'Audit log': 'ऑडिट लॉग', 'Who': 'किसने', 'When': 'कब', 'On': 'किस पर', 'Language': 'भाषा', 'English': 'English', 'Hindi': 'हिन्दी',
  'Rows per page': 'प्रति पृष्ठ पंक्तियाँ', 'Loading...': 'लोड हो रहा है...', 'No data': 'कोई डेटा नहीं', 'Page': 'पृष्ठ', 'of': 'में से',
  'Good morning': 'सुप्रभात', 'Good afternoon': 'शुभ दोपहर', 'Good evening': 'शुभ संध्या', 'Welcome': 'स्वागत है',
  'Customize dashboard': 'डैशबोर्ड अनुकूलित करें', 'Customize': 'अनुकूलित करें', 'Install app': 'ऐप इंस्टॉल करें',
};

// placeholders / titles use the same dictionary, plus these longer ones
export const HI_ATTR: Record<string, string> = {
  'Search employees, candidates, pages…': 'कर्मचारी, उम्मीदवार, पेज खोजें…', 'Search name, email, mobile...': 'नाम, ईमेल, मोबाइल खोजें...',
  'Search by employee name or code...': 'कर्मचारी का नाम या कोड से खोजें...', 'Search employees...': 'कर्मचारी खोजें...', 'Search...': 'खोजें...',
  'Search by employee name or ID...': 'कर्मचारी का नाम या आईडी से खोजें...', 'Search by tag, name, serial or employee...': 'टैग, नाम, सीरियल या कर्मचारी से खोजें...',
  'Notifications': 'सूचनाएँ', 'Settings': 'सेटिंग्स', 'Search': 'खोजें', 'Refresh': 'रीफ़्रेश',
};
