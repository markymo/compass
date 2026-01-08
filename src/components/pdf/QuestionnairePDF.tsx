/* eslint-disable jsx-a11y/alt-text */
import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

// Create styles
const styles = StyleSheet.create({
    page: {
        padding: 30,
        backgroundColor: '#ffffff'
    },
    header: {
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#cccccc',
        paddingBottom: 10,
    },
    title: {
        fontSize: 24,
        marginBottom: 10,
        fontWeight: 'bold',
    },
    subtitle: {
        fontSize: 12,
        color: '#666666',
    },
    section: {
        margin: 10,
        padding: 10,
    },
    questionBox: {
        marginBottom: 15,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eeeeee',
    },
    questionText: {
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 5,
        color: '#222222',
    },
    answerBox: {
        marginTop: 5,
        backgroundColor: '#f9f9f9',
        padding: 8,
        borderRadius: 4,
    },
    answerText: {
        fontSize: 11,
        color: '#444444',
    },
    emptyAnswer: {
        fontSize: 11,
        color: '#999999',
        fontStyle: 'italic',
    },
    categoryHeader: {
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 20,
        marginBottom: 10,
        color: '#333333',
        backgroundColor: '#f0f0f0',
        padding: 5,
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontSize: 10,
        color: 'grey',
    }
});

interface QuestionnairePDFProps {
    title: string;
    orgName: string; // The FI who owns the questionnaire
    clientName: string; // The client filling it out
    questions: any[];
}

export function QuestionnairePDF({ title, orgName, clientName, questions }: QuestionnairePDFProps) {
    // Group questions by category
    const categories = Array.from(new Set(questions.map((q: any) => q.category || "Uncategorized"))).sort();

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <View style={styles.header}>
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.subtitle}>Prepared for: {orgName}</Text>
                    <Text style={styles.subtitle}>Response by: {clientName}</Text>
                    <Text style={styles.subtitle}>Date: {new Date().toLocaleDateString()}</Text>
                </View>

                {categories.map((cat) => (
                    <View key={cat as string}>
                        <Text style={styles.categoryHeader}>{cat as string}</Text>
                        {questions
                            .filter((q: any) => (q.category || "Uncategorized") === cat)
                            .map((q: any, i: number) => (
                                <View key={i} style={styles.questionBox}>
                                    <Text style={styles.questionText}>Q: {q.originalText}</Text>
                                    <View style={styles.answerBox}>
                                        {q.answer ? (
                                            <Text style={styles.answerText}>{q.answer}</Text>
                                        ) : (
                                            <Text style={styles.emptyAnswer}>No answer provided</Text>
                                        )}
                                    </View>
                                </View>
                            ))}
                    </View>
                ))}

                <Text style={styles.footer} render={({ pageNumber, totalPages }) => (
                    `${pageNumber} / ${totalPages}`
                )} fixed />
            </Page>
        </Document>
    );
}
