import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Link,
    Preview,
    Section,
    Text,
    Tailwind,
} from "@react-email/components";
import * as React from "react";

interface SupplierInviteEmailProps {
    inviterName: string;
    inviterEmail: string;
    orgName: string;
    leName: string; // The Project/Entity Name
    role: string;
    message?: string;
    inviteLink: string;
}

export const SupplierInviteEmail = ({
    inviterName,
    inviterEmail,
    orgName,
    leName,
    role,
    message,
    inviteLink,
}: SupplierInviteEmailProps) => {
    return (
        <Html>
            <Head />
            <Preview>Join {orgName} on Compass to collaborate on {leName}</Preview>
            <Tailwind>
                <Body className="bg-white my-auto mx-auto font-sans">
                    <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
                        <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                            You've been invited to collaborate
                        </Heading>
                        <Text className="text-black text-[14px] leading-[24px]">
                            Hello,
                        </Text>
                        <Text className="text-black text-[14px] leading-[24px]">
                            <strong>{inviterName}</strong> ({inviterEmail}) has invited you to join the <strong>{orgName}</strong> workspace on Compass.
                        </Text>
                        <Text className="text-black text-[14px] leading-[24px]">
                            They are requesting your input for the following entity:
                        </Text>
                        <Section className="bg-slate-50 p-4 rounded-md border border-slate-200 my-4 text-center">
                            <Text className="text-slate-800 font-semibold text-lg m-0">
                                {leName}
                            </Text>
                            <Text className="text-slate-500 text-xs m-0 mt-1">
                                Role: {role}
                            </Text>
                        </Section>

                        {message && (
                            <Section className="bg-yellow-50 p-4 rounded-md border border-yellow-100 my-4">
                                <Text className="text-yellow-800 text-sm italic m-0">
                                    "{message}"
                                </Text>
                            </Section>
                        )}

                        <Section className="text-center mt-[32px] mb-[32px]">
                            <Button
                                className="bg-[#4F46E5] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
                                href={inviteLink}
                            >
                                Accept Invitation
                            </Button>
                        </Section>
                        <Text className="text-black text-[14px] leading-[24px]">
                            or copy and paste this URL into your browser:{" "}
                            <Link href={inviteLink} className="text-blue-600 no-underline">
                                {inviteLink}
                            </Link>
                        </Text>
                        <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
                        <Text className="text-[#666666] text-[12px] leading-[24px]">
                            This invitation was intended for <span className="text-black">{role}</span>. If you were not expecting this invitation, you can ignore this email.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default SupplierInviteEmail;
