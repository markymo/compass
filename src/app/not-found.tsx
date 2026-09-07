export default function NotFound() {
    return (
        <div className="flex h-[calc(100vh-10rem)] items-center justify-center bg-background text-foreground">
            <div className="flex items-center gap-4">
                <h1 className="text-2xl font-medium border-r border-border pr-4 leading-none text-foreground">
                    404
                </h1>
                <h2 className="text-sm font-normal leading-none text-foreground">
                    This page could not be found.
                </h2>
            </div>
        </div>
    );
}
