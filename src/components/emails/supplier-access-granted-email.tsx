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

interface SupplierAccessGrantedEmailProps {
    inviterName: string;
    inviterEmail: string;
    orgName: string;
    leName: string;
    role: string;
    workspaceUrl: string;
}

export const SupplierAccessGrantedEmail = ({
    inviterName,
    inviterEmail,
    orgName,
    leName,
    role,
    workspaceUrl,
}: SupplierAccessGrantedEmailProps) => {
    return (
        <Html>
            <Head />
            <Preview>Access granted to {orgName} on OnPro for {leName}</Preview>
            <Tailwind>
                <Body className="bg-white my-auto mx-auto font-sans">
                    <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
                        <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                            You have been granted access
                        </Heading>
                        <Text className="text-black text-[14px] leading-[24px]">
                            Hello,
                        </Text>
                        <Text className="text-black text-[14px] leading-[24px]">
                            <strong>{inviterName}</strong> ({inviterEmail}) has granted your OnPro account access to the <strong>{orgName}</strong> workspace.
                        </Text>
                        <Text className="text-black text-[14px] leading-[24px]">
                            You have been assigned to the following Relationship:
                        </Text>
                        <Section className="bg-slate-50 p-4 rounded-md border border-slate-200 my-4 text-center">
                            <Text className="text-slate-800 font-semibold text-lg m-0">
                                {leName}
                            </Text>
                            <Text className="text-slate-500 text-xs m-0 mt-1">
                                Role: {role}
                            </Text>
                        </Section>
                        <Text className="text-slate-600 text-[13px] leading-[20px] bg-slate-50 p-3 rounded border border-slate-100">
                            Because you already hold an active OnPro account, no invitation acceptance or password setup is required. You can access this workspace immediately with your existing credentials.
                        </Text>

                        <Section className="text-center mt-[32px] mb-[32px]">
                            <Button
                                className="bg-[#4F46E5] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
                                href={workspaceUrl}
                            >
                                Open OnPro Workspace
                            </Button>
                        </Section>
                        <Text className="text-black text-[14px] leading-[24px]">
                            or access your workspace directly at:{" "}
                            <Link href={workspaceUrl} className="text-blue-600 no-underline">
                                {workspaceUrl}
                            </Link>
                        </Text>
                        <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
                        <Text className="text-[#666666] text-[12px] leading-[24px]">
                            This notification was sent to your registered email address regarding your access as <span className="text-black">{role}</span>.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default SupplierAccessGrantedEmail;
