import React from "react";
import Link from "next/link";

export default function PrivacyPage() {
    return (
        <div className="container mx-auto px-4 py-16 md:px-6 lg:py-24">
            <div className="mx-auto max-w-3xl prose prose-slate dark:prose-invert">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl mb-8">
                    Privacy Policy
                </h1>

                <p className="text-sm text-slate-500 mb-8">
                    Last updated: {new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}
                </p>

                <section className="space-y-6 text-slate-700 dark:text-slate-300">
                    <p>
                        Compass (“we” or “us”) is committed to protecting your privacy. This policy details how we collect, use, and store
                        your personal information.
                    </p>

                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Introduction</h3>
                        <p>
                            Compass is registered with the UK Information Commissioner's Office (ICO).
                            Reference number: [Insert ICO Reference Number]
                        </p>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Call Recording</h3>
                        <p>
                            Telephone calls to Compass telephone numbers, including employee mobile devices, may be recorded for the following purposes in connection with our business:
                        </p>
                        <ul className="list-disc pl-6 mt-2 space-y-1">
                            <li>Establishing the facts of a conversation</li>
                            <li>Ascertaining, monitoring or demonstrating compliance with certain regulatory or internal practices and procedures</li>
                            <li>Preventing or detecting crime</li>
                            <li>Investigating or detecting unauthorised use of the telephone system</li>
                            <li>System maintenance</li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Personal Information</h3>
                        <p>
                            We receive, collect and store information that you share with us via this website or provide us in any other way, including in any dealings with you.
                        </p>
                        <p className="mt-2">
                            Most of the personal information we process is provided to us directly by you for one of the following reasons:
                        </p>
                        <ul className="list-disc pl-6 mt-2 space-y-1">
                            <li>We have dealt with you professionally, including as part of our marketing and transaction activity.</li>
                            <li>You wish to attend, or have attended, a course or event.</li>
                            <li>You have subscribed to our research and market updates.</li>
                            <li>You have applied for a job or secondment with us.</li>
                        </ul>
                        <p className="mt-2">
                            Information we collect may be used to contact you by telephone or email in order to: operate the services we may provide to you; to provide you with customer assistance and support; for administrative purposes; to provide marketing and promotional materials; to create aggregated statistical data and to comply with applicable laws and regulations.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Data Retention</h3>
                        <p>
                            In accordance with regulatory requirements, we retain data for a period of 5 years, or, if required by the Financial Conduct Authority, up to 10 years.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Your Rights</h3>
                        <p>
                            Under the General Data Protection Regulation (GDPR), you have the right to access, rectify, erase, restrict the processing or portability of data that we hold on you. You may enforce these rights by contacting us via email at <a href="mailto:advice@compass.com" className="text-amber-500 hover:underline">advice@compass.com</a>.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Hosting and Security</h3>
                        <p>
                            This website is hosted on a secure platform. Your data may be stored through our provider's data storage, databases and general applications. They store your data on secure servers behind a firewall.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Third Party Disclosure</h3>
                        <p>
                            We do not disclose any personal information that we hold to third parties, except as required by regulation or law.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Contact Us</h3>
                        <p>
                            For further information on how your information is used, collected or stored, to access, correct, amend or delete any information we hold on you, or to opt out of marketing communications at any time, please contact us at <a href="mailto:advice@compass.com" className="text-amber-500 hover:underline">advice@compass.com</a>.
                        </p>
                    </div>
                </section>
            </div>
        </div>
    );
}
