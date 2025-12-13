import React from "react";

export default function TermsPage() {
    return (
        <div className="container mx-auto px-4 py-16 md:px-6 lg:py-24">
            <div className="mx-auto max-w-3xl prose prose-slate dark:prose-invert">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl mb-8">
                    Terms of Use
                </h1>

                <p className="text-sm text-slate-500 mb-8">
                    Last updated: {new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}
                </p>

                <section className="space-y-6 text-slate-700 dark:text-slate-300">
                    <p>
                        1. Compass (“we” or “us”) owns and operates this website (“Site”).
                    </p>

                    <p>
                        2. This Site is directed exclusively at Professional Clients and Eligible Counterparties,
                        as defined by the United Kingdom Financial Conduct Authority under COBS 3.5 and COBS 3.6,
                        and equivalent entities in other jurisdictions. By accessing this Site, you warrant that
                        you meet the relevant criteria and have read and acknowledge the Site's Risk Warnings.
                    </p>

                    <p>
                        3. Your use of the Site is subject to these Terms of Use. By using the Site, you will be
                        deemed to have accepted and agreed to be bound by these Terms of Use. We reserve the right
                        at any time without notice to revise the content of our Site (including the services offered
                        by us) and these terms and conditions. Any changes to these terms and conditions will be
                        posted on our Site and by continuing to use our Site following any such change you will
                        signify that you agree to be bound by the revised terms and conditions of use.
                    </p>

                    <p>
                        4. You are responsible for all access to the Site using your Internet connection, even if
                        the access is by another person. We reserve the right to restrict your access to the Site
                        or part of it. Access to restricted areas of the Site may be subject to registration and
                        other conditions. If we grant you permission to access a restricted area, we may withdraw
                        that permission at any time (including where you breach any of these Terms of Use).
                    </p>

                    <p>
                        5. We will use reasonable efforts to ensure that the Site is available and compiled with
                        reasonable skill and care. However, we provide the Site on an ‘as is’ basis and we do not
                        represent or warrant that:
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>5.1. access to our Site, or any part of it, will be uninterrupted, reliable or fault-free; or</li>
                        <li>5.2. our Site or any of its contents will be accurate, complete or reliable.</li>
                    </ul>

                    <p>
                        6. To the maximum extent permitted by law, we exclude:
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>6.1. all conditions, warranties and other terms that might otherwise be implied by law into these Terms of Use; and</li>
                        <li>6.2. all liability to you, whether arising under these Terms of Use or otherwise in connection with your use of the Site, including as a result of:
                            <ul className="list-disc pl-6 mt-2 space-y-2">
                                <li>6.2.1. any technical, factual, textual or typographical inaccuracies, errors or omissions on or relating to our Site or any information on our Site;</li>
                                <li>6.2.2. the unavailability of our Site (or any part of it), goods or services;</li>
                                <li>6.2.3. any delay in providing, or failure to provide or make available, goods or services;</li>
                                <li>6.2.4. any misrepresentation on or relating to our Site or the goods or the services (other than a fraudulent misrepresentation made by us or on our behalf).</li>
                            </ul>
                        </li>
                    </ul>
                    <p>
                        Each of the above exclusions or limitations shall be construed as a separate, and severable, provision of these terms and conditions. You agree that each of these limitations is reasonable having regard to the nature of our Site, and in particular given that any goods or services provided by us shall be subject to a separate contract between us.
                    </p>

                    <p>
                        7. We are the proprietor of the “Compass” trade marks in the United Kingdom and other countries.
                        All other trade marks, product names and company names or logos used in our site are our property
                        or that of their respective owners. No permission is given by us in respect of the use of any such
                        trade marks, get-up, product names, company names, logos or titles and such use may constitute an
                        infringement of the holder’s rights. All rights in the design, text, graphics and other material
                        on our site and the selection or arrangement thereof are the copyright of us or other third parties.
                        Permission is granted to electronically copy and print in hard copy portions of our site solely
                        for your internal business use or in connection with the acquisition of goods or services through
                        our site. Any other use of materials on our site (including reproduction for purposes other than
                        those noted above and alteration, modification, distribution, or republication) without our prior
                        written permission is strictly prohibited.
                    </p>

                    <p>
                        8. Certain links, including hypertext links, in our Site will take you outside our Site. Links
                        are provided for your convenience and inclusion of any link does not imply endorsement or approval
                        by us of the linked Site, its operator or its content. We are not responsible for the content of
                        any website outside our Site.
                    </p>

                    <p>
                        9. Your permission to use the Site is personal to you and non-transferable. You agree that you
                        will use our Site only for your internal business purposes and that you shall not exploit our Site
                        or any of its contents for any commercial purpose. Your use of the Site is conditional on your
                        compliance with the rules of conduct set forth in these Terms of Use and you agree that you will not:
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>9.2. use the Site for any fraudulent or unlawful purpose;</li>
                        <li>9.3. use the Site to defame, abuse, harass, stalk, threaten or otherwise violate the rights of others, including without limitation others’ privacy rights or rights of publicity;</li>
                        <li>9.4. impersonate any person or entity, falsely state or otherwise misrepresent your affiliation with any person or entity in connection with the Site; or express or imply that we endorse any statement you make;</li>
                        <li>9.5. interfere with or disrupt the operation of the Site or the servers or networks used to make the Site available; or violate any requirements, procedures, policies or regulations of such networks;</li>
                        <li>9.6. transmit or otherwise make available in connection with the Site any virus, worm, Trojan horse or other computer code that is harmful or invasive or may or is intended to damage the operation of, or to monitor the use of, any hardware, software, or equipment;</li>
                        <li>9.7. reproduce, duplicate, copy, sell, resell, or otherwise exploit for any commercial purposes, any portion of, use of, or access to the Site;</li>
                        <li>9.8. modify, adapt, translate, reverse engineer, decompile or disassemble any portion of the Site. If you wish to reverse engineer any part of the Site to create an interoperable program you must contact us and we may provide interface data subject to verification of your identity and other information;</li>
                        <li>9.9. remove any copyright, trade mark or other proprietary rights notice from the Site or materials originating from the Site;</li>
                        <li>9.10. frame or mirror any part of the Site without our express prior written consent;</li>
                        <li>9.11. create a database by systematically downloading and storing Site content;</li>
                        <li>9.12. use any manual or automatic device in any way to gather Site content or reproduce or circumvent the navigational structure or presentation of the Site without our express prior written consent.</li>
                    </ul>
                    <p>
                        Notwithstanding the foregoing, we grant the operators of public online search engines limited permission to use search retrieval applications to reproduce materials from the Site for the sole purpose of and solely to the extent necessary for creating publicly available searchable indices of such materials solely in connection with each operator’s public online search service.
                    </p>

                    <p>
                        10. We reserve the right to revoke these exceptions either generally or in specific instances.
                    </p>

                    <p>
                        11. You may create a link to this Site, provided that:
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>11.2. the link is fair and legal and is not presented in a way that is:
                            <ul className="list-disc pl-6 mt-2 space-y-2">
                                <li>11.2.1. misleading or could suggest any type of association, approval or endorsement by us that does not exist, or</li>
                                <li>11.2.2. harmful to our reputation or the reputation of any of our affiliates;</li>
                            </ul>
                        </li>
                        <li>11.3. you retain the legal right and technical ability to immediately remove the link at any time, following a request by us to do so;</li>
                        <li>11.4. the link will not cause this Site or any content on this Site to be:
                            <ul className="list-disc pl-6 mt-2 space-y-2">
                                <li>11.4.1. embedded in or ‘framed’ by any other website, or</li>
                                <li>11.4.2. otherwise displayed in a way different to the way originally intended by us.</li>
                            </ul>
                        </li>
                    </ul>

                    <p>
                        12. We reserve the right to require you to immediately remove any link to the Site at any time and you shall immediately comply with any request by us to remove any such link.
                    </p>

                    <p>
                        13. You agree that we may collect, store and use information about you, and may record calls made to Compass telephone numbers, in accordance with our privacy policy.
                    </p>

                    <p>
                        14. These Terms of Use are effective until terminated. We may, at any time and for any reason, terminate your access to or use of the Site. If we terminate your access to the Site you will not have the right to bring claims against us or our affiliates with respect to such termination. We and our affiliates shall not be liable for any termination of your access to the Site.
                    </p>

                    <p>
                        15. These Terms of Use will be governed by and construed in accordance with the laws of England, and the courts of England will have non-exclusive jurisdiction over any claim or dispute arising under or in connection with these Terms of Use.
                    </p>

                    <p>
                        16. The enforceability or otherwise of any provisions of these Terms of Use shall not affect the enforceability of the rest of these Terms of Use.
                    </p>
                </section>
            </div>
        </div>
    );
}
