'use strict'
const fs = require('fs')
const mongoose = require('mongoose')
const md5 = require('md5')

const studentSchema = new mongoose.Schema({ id: { type: String, required: true, index: true } },
	{ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },	strict: false
})
studentSchema.set('toJSON', { transform: (doc, ret) => { ret.id = ret._id; delete ret._id } })
//mongoose.connect('mongodb://localhost:27017/students')

const studentsDB = mongoose.model('students',studentSchema)

let filename = 'competencias_032C_2ºC-BACHILLERATO'//'report001-_032A_2ºA-BACHILLERATO_ok'
let lines = fs.readFileSync(filename+'.csv').toString().split("\r\n");

let subjects = []
let previousSubjects = []
let students = {}
let currentId = ''
let currentEvaluation = 0
let currentNAI = 0
let firstSubjects = false
let lineNumber=1
let re = /\./gi
let decimal = '.'
let separator = ','

let getSubjectInfo = (fields, offset, integers = 0, subjectPositions = [], marksPositions = []) => {
    fields.map(field => {
        if (field !== '' && !Number.isNaN(Number(field)) || field.indexOf('_') !== -1 
        || (field.indexOf('/') !== -1 && field.indexOf('Fecha') === -1 && field.indexOf('Página') === -1 && field.indexOf('2017') === -1)) {
            field.indexOf('.') !== -1 ? marksPositions.push(integers) : field.indexOf('_') !== -1 ? marksPositions.push(integers) : subjectPositions.push(integers)
        }
        integers++
    })
    return { subjectPositions: subjectPositions.filter(p => p > offset), marksPositions: marksPositions.filter(p => p > offset) }
}

let getSubject = (subjects, position) => subjects.find(s => s.position === position)

let getSubjects = (fields) => {
    let posField = 0
    subjects = []
    fields.map(field => {
        if (field !== '' && field !== '#VALUE!') {
            if (field.indexOf(':') !== -1) {
                let subjectfull = field.split(':')
                subjects.push({ subject: subjectfull[0], description: subjectfull[1], position: posField })
            }
            else {
                subjects.push({ subject: field, position: posField })
            }
            field === 'Evaluación' ? currentEvaluation = posField : null
            field.indexOf('Insuficiente') !== -1 ? currentNAI = posField : null
        }
        posField++
    })
    firstSubjects = true
    return { subjects, firstSubjects }
}

let processLines = (lines) => {
    lines.map(line => {
        //console.log('##################################################')
        console.log('lineNumber',lineNumber++)
        let fields = line.split(';')
        if (line.indexOf('Evaluación') !== -1) {
            previousSubjects = subjects
            [ subjects, firstSubjects ] = getSubjects(fields)
            //console.log('subjects',subjects, currentNAI)
        }    
        else if (firstSubjects){//} if (fields[0] && fields[0].length === 40 && fields.indexOf(' ') === -1) {
            console.log(fields[0])
            if (fields[0] && fields[0].length === 40 && fields.indexOf(' ') === -1) { 
                currentId = fields[0]
                if(!students[currentId]) {
                    //console.log('--------------------------------currentId',fields[0],JSON.stringify(students))
                    students[currentId]={id: currentId,subjects:{}}
                }
            }
            let { subjectPositions, marksPositions } = getSubjectInfo(fields, currentNAI)
            //console.log('ssssssssssss',currentNAI,subjectPositions, marksPositions, firstSubjects)
            if(subjectPositions.length > 0 || marksPositions.length > 0){
                let subject={}
                if(subjectPositions && subjectPositions.length !== 0) {
                    for (let i = 0; i < subjectPositions.length; i++) {
                        let subject=getSubject(subjects, subjectPositions[i])
                        //console.log('subject at position',i,subject)
                        if(i+1<subjectPositions.length){
                            subject.marks = subjects.filter(p=>p.position>subjectPositions[i]&&p.position<subjectPositions[i+1])
                        }
                        else {
                            subject.marks = subjects.filter(p=>p.position>subjectPositions[i])
                        }
                        let marks2=[]
                        for (let j=0; j<marksPositions.length; j++){
                            let esub=subject.marks.find(m=>m.position===marksPositions[j])
                            esub?marks2.push(Object.assign({},esub,{evaluation:fields[currentEvaluation],mark:fields[marksPositions[j]]})):null
                         }
                        //subject.evaluations[fields[currentEvaluation]]={evaluation:fields[currentEvaluation],mark:fields[subjectPositions[i]]}
                        let evaluations={}
                        evaluations[fields[currentEvaluation]] = {evaluation:fields[currentEvaluation],mark:fields[subjectPositions[i]]}
                        console.log(subject, students[currentId], currentId)
                        students[currentId].subjects[md5(subject.subject)] = Object.assign({}, students[currentId].subjects[md5(subject.subject)],{
                            name: subject.subject,
                            position: subject.position,
                            marks: students[currentId].subjects[md5(subject.subject)] ? //subject.marks,
                             students[currentId].subjects[md5(subject.subject)].marks ?
                             students[currentId].subjects[md5(subject.subject)].marks.concat(marks2) :
                             [] : marks2,
                            evaluations: students[currentId].subjects[md5(subject.subject)] ? 
                             students[currentId].subjects[md5(subject.subject)].evaluations ? 
                             Object.assign({},students[currentId].subjects[md5(subject.subject)].evaluations,evaluations) :
                             {} : evaluations
                            })
                            //studentsDB.findOneAndUpdate({id:currentId},students[currentId],{upsert:true, new:true}).then((student)=>{console.log('created',student.id)})
                        // console.log('student',i,'currentId',currentId,JSON.stringify(students[currentId]),subject)
                    }
                }
            }  
        }
    })
    return students
}

let studentsArray = []
let studentsJson = []
processLines(lines)
let str = 'student'+separator+'subject'+separator+'test'+separator+'test_mark'+separator+'test_evaluation'+separator+'test_final_evaluation'+separator+'test_final_mark'+'\n'
Object.keys(students).map(student => {
    let subjectsArray = []
    Object.keys(students[student].subjects).map(subject => {
        let aSubject = (students[student].subjects[subject])
        delete aSubject.position
        //console.log(student)
        aSubject.marks.map((mark) => {
            delete mark.position
            studentsJson.push({student: student, type: 'partial', subject: aSubject.name, mark: mark.mark, evaluation: mark.evaluation})
            console.log(student+separator+aSubject.name+separator+mark.subject+separator+mark.mark+separator+mark.evaluation+separator+separator)
            str = str + (student+separator+aSubject.name+separator+mark.subject+separator+mark.mark.replace(re,decimal)+separator+mark.evaluation+separator+separator+'\n')
        })
        Object.keys(aSubject.evaluations).map((evaluation) => {
            studentsJson.push({student: student, type: 'global', subject: aSubject.name, mark: aSubject.evaluations[evaluation].mark, evaluation: aSubject.evaluations[evaluation].evaluation})
            console.log(student+separator+aSubject.name+separator+separator+separator+separator+aSubject.evaluations[evaluation].evaluation+separator+aSubject.evaluations[evaluation].mark)
            let mmark = aSubject.evaluations[evaluation].mark+'.0'
            if(aSubject.evaluations[evaluation].mark.indexOf('/') !== -1){
                let umark = aSubject.evaluations[evaluation].mark.split('/')
                mmark = umark[1].trim()+'.0'
                console.log('mmark',mmark,umark)
            }
            str = str + (student+separator+aSubject.name+separator+separator+separator+separator+aSubject.evaluations[evaluation].evaluation+separator+mmark+'\n')
        })
        subjectsArray.push(aSubject)
        //console.log(students[student][subject])
    })
    studentsArray.push({id: students[student].id, subjects: subjectsArray})
})

//studentsArray.map(student => { studentsDB.findOneAndUpdate({id:student.id},student,{upsert:true, new:true}).then((student)=>{console.log('created',student.id)}) })
fs.writeFile(filename+'_flat.json', JSON.stringify(studentsJson, null, 2), function(err) { if (err) { console.log('Error al escribir...',err) }})
fs.writeFile('json/'+filename+'.json', JSON.stringify(studentsArray, null, 2), function(err) { if (err) { console.log('Error al escribir...',err) }})
fs.writeFile(filename+'_flat.csv', str, function(err) { if (err) { console.log('Error al escribir...',err) }})
//console.log(JSON.stringify(students))