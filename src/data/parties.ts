/* ── Customers (fabricators, builders, retail) and suppliers (mills/stockists) ── */

export interface Client {
  id: string
  name: string
  type: 'B2B Fabricator' | 'Builder / Contractor' | 'B2C Retail' | 'Dealer'
  contact: string
  phone: string
  email: string
  gstin: string
  state: string
  area: string
  creditDays: number
  creditLimit: number
  since: string
  status: 'Active' | 'Dormant' | 'On Hold'
}

export const CLIENTS: Client[] = [
  { id:'C01', name:'Sri Balaji Aluminium Fabricators', type:'B2B Fabricator',      contact:'Ramesh K',      phone:'+91 98450 11234', email:'sribalajifab@gmail.com',    gstin:'29AAFCS1234K1Z8', state:'Karnataka', area:'K R Puram',      creditDays:30, creditLimit:800000,  since:'2018-04-12', status:'Active'   },
  { id:'C02', name:'Nandi Constructions Pvt Ltd',      type:'Builder / Contractor', contact:'Suresh Gowda',  phone:'+91 99001 45677', email:'purchase@nandicon.in',      gstin:'29AABCN8891P1ZQ', state:'Karnataka', area:'Whitefield',     creditDays:45, creditLimit:2500000, since:'2019-07-02', status:'Active'   },
  { id:'C03', name:'Perfect Glass & Aluminium Works',  type:'B2B Fabricator',       contact:'Imran Pasha',   phone:'+91 97400 88213', email:'perfectglasswork@gmail.com',gstin:'29AKPPP4412M1Z3', state:'Karnataka', area:'Ramamurthy Ngr', creditDays:30, creditLimit:600000,  since:'2019-01-20', status:'Active'   },
  { id:'C04', name:'Sai Krupa Interiors',              type:'B2B Fabricator',       contact:'Manjunath S',   phone:'+91 96322 77410', email:'saikrupaint@gmail.com',     gstin:'29BXTPS9902L1ZR', state:'Karnataka', area:'Hoodi',          creditDays:21, creditLimit:400000,  since:'2020-11-05', status:'Active'   },
  { id:'C05', name:'Skyline Facades LLP',              type:'Builder / Contractor', contact:'Anand Rao',     phone:'+91 90080 22195', email:'anand@skylinefacades.com',  gstin:'29AAMFS5567H1ZL', state:'Karnataka', area:'Mahadevapura',   creditDays:60, creditLimit:3500000, since:'2021-03-18', status:'Active'   },
  { id:'C06', name:'Venkateshwara Traders',            type:'Dealer',               contact:'Prasad N',      phone:'+91 98860 33127', email:'vtraders.blr@gmail.com',    gstin:'29AGHPN2278D1ZK', state:'Karnataka', area:'Hoskote',        creditDays:15, creditLimit:500000,  since:'2020-02-28', status:'Active'   },
  { id:'C07', name:'Metro Aluminium Fabricators',      type:'B2B Fabricator',       contact:'Vijay Kumar',   phone:'+91 94480 61129', email:'metroalufab@gmail.com',     gstin:'29AJTPK1123N1ZY', state:'Karnataka', area:'Battarahalli',   creditDays:30, creditLimit:700000,  since:'2018-09-14', status:'Active'   },
  { id:'C08', name:'Green Meadows Apartments (AOA)',   type:'Builder / Contractor', contact:'Lakshmi P',     phone:'+91 99164 55023', email:'gmaoa.blr@gmail.com',       gstin:'—',               state:'Karnataka', area:'Medahalli',      creditDays:15, creditLimit:250000,  since:'2023-06-01', status:'Active'   },
  { id:'C09', name:'Anjali Enterprises',               type:'Dealer',               contact:'Anjali Reddy',  phone:'+91 91480 20076', email:'anjalient.hyd@gmail.com',   gstin:'36AQWPR6612B1ZM', state:'Telangana', area:'Hyderabad',      creditDays:30, creditLimit:900000,  since:'2022-08-09', status:'Active'   },
  { id:'C10', name:'Shakti Fabrication Works',         type:'B2B Fabricator',       contact:'Naveen Y',      phone:'+91 88840 71256', email:'shaktifab@gmail.com',       gstin:'29BFTPY4498C1ZA', state:'Karnataka', area:'Kadugodi',       creditDays:21, creditLimit:350000,  since:'2021-12-11', status:'Active'   },
  { id:'C11', name:'Modern Windows & Doors',           type:'B2B Fabricator',       contact:'Basha M',       phone:'+91 90350 44810', email:'modernwd.blr@gmail.com',    gstin:'29ADQPM3345J1ZP', state:'Karnataka', area:'TC Palya',       creditDays:30, creditLimit:450000,  since:'2020-05-22', status:'On Hold'  },
  { id:'C12', name:'Rajesh Kumar (Retail)',            type:'B2C Retail',           contact:'Rajesh Kumar',  phone:'+91 99450 12388', email:'—',                         gstin:'—',               state:'Karnataka', area:'Ayyappa Nagar',  creditDays:0,  creditLimit:0,       since:'2026-05-14', status:'Active'   },
  { id:'C13', name:'Sowmya Residency Project',         type:'Builder / Contractor', contact:'Girish B',      phone:'+91 97310 66542', email:'girish.sowmya@gmail.com',   gstin:'29AWEPB7734F1ZV', state:'Karnataka', area:'Budigere',       creditDays:45, creditLimit:1500000, since:'2024-02-19', status:'Active'   },
  { id:'C14', name:'Classic Aluminium Centre',         type:'Dealer',               contact:'Farhan A',      phone:'+91 89710 30094', email:'classicalu@gmail.com',      gstin:'29AZOPA1189R1ZT', state:'Karnataka', area:'Devanahalli',    creditDays:21, creditLimit:400000,  since:'2022-01-30', status:'Dormant'  },
]

export interface Supplier {
  id: string
  name: string
  category: string
  contact: string
  phone: string
  gstin: string
  state: string
  creditDays: number
  leadDays: number
}

export const SUPPLIERS: Supplier[] = [
  { id:'S01', name:'Jindal Aluminium Ltd — Depot',   category:'Extruded Sections', contact:'Depot Sales',   phone:'+91 80 2839 4444', gstin:'29AAACJ4436N1ZG', state:'Karnataka',  creditDays:30, leadDays:7  },
  { id:'S02', name:'Hindalco Authorised Stockist',   category:'Sheets & Coils',    contact:'Mahesh Jain',   phone:'+91 98860 71123', gstin:'29AABCH1234K1ZD', state:'Karnataka',  creditDays:21, leadDays:5  },
  { id:'S03', name:'Bhoruka Extrusions Pvt Ltd',     category:'Extruded Sections', contact:'Sales Desk',    phone:'+91 80 2204 8800', gstin:'29AAACB5567L1ZR', state:'Karnataka',  creditDays:30, leadDays:10 },
  { id:'S04', name:'Alstrong Enterprises India',     category:'ACP Panels',        contact:'Region Sales',  phone:'+91 99100 44521', gstin:'07AAACA9987M1ZB', state:'Delhi',      creditDays:15, leadDays:12 },
  { id:'S05', name:'Saint-Gobain Glass Distributor', category:'Glass',             contact:'Kiran Shetty',  phone:'+91 97390 22014', gstin:'29AAECS3321P1ZN', state:'Karnataka',  creditDays:15, leadDays:4  },
  { id:'S06', name:'Ozone / Ebco Hardware Agency',   category:'Hardware',          contact:'Deepak M',      phone:'+91 96110 87720', gstin:'29AFDPM8812Q1ZE', state:'Karnataka',  creditDays:21, leadDays:6  },
]
