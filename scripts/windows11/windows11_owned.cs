using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Automation;

namespace JobApplyValidation {
    // This test owner never accepts arbitrary process IDs for termination.
    // Processes are suspended, assigned to our retained job, then resumed.
    public sealed class OwnedApp : IDisposable {
        [StructLayout(LayoutKind.Sequential)] struct StartInfo {
            public uint cb; public string reserved; public string desktop; public string title;
            public uint x,y,xsize,ysize,xchars,ychars,fill,flags; public ushort show,reserved2;
            public IntPtr bytes,stdin,stdout,stderr;
        }
        [StructLayout(LayoutKind.Sequential)] struct ProcessInfo { public IntPtr process,thread; public uint pid,tid; }
        [StructLayout(LayoutKind.Sequential)] struct BasicLimits {
            public long processTime,jobTime; public uint flags; public UIntPtr minWorking,maxWorking;
            public uint active; public UIntPtr affinity; public uint priority,scheduling;
        }
        [StructLayout(LayoutKind.Sequential)] struct IoCounters { public ulong r,w,o,rb,wb,ob; }
        [StructLayout(LayoutKind.Sequential)] struct ExtendedLimits {
            public BasicLimits basic; public IoCounters io; public UIntPtr processMemory,jobMemory,peakProcess,peakJob;
        }
        [StructLayout(LayoutKind.Sequential)] struct FileTime { public uint low,high; }
        [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr security,string name);
        [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int kind,IntPtr data,uint length);
        [DllImport("kernel32.dll", SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job,int kind,IntPtr data,uint length,out uint returned);
        [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool CreateProcess(string application,StringBuilder command,IntPtr a,IntPtr t,bool inherit,uint flags,IntPtr env,string cwd,ref StartInfo startup,out ProcessInfo info);
        [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
        [DllImport("kernel32.dll", SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
        [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateProcess(IntPtr process,uint exit);
        [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateJobObject(IntPtr job,uint exit);
        [DllImport("kernel32.dll", SetLastError=true)] static extern uint WaitForSingleObject(IntPtr value,uint milliseconds);
        [DllImport("kernel32.dll", SetLastError=true)] static extern bool CloseHandle(IntPtr value);
        [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,uint pid);
        [DllImport("kernel32.dll", SetLastError=true)] static extern bool IsProcessInJob(IntPtr process,IntPtr job,out bool member);
        [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool QueryFullProcessImageName(IntPtr process,uint flags,StringBuilder path,ref uint length);
        [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetProcessTimes(IntPtr process,out FileTime created,out FileTime exited,out FileTime kernel,out FileTime user);
        [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window,out uint pid);
        [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr window);
        [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
        [StructLayout(LayoutKind.Sequential)] struct KeyboardInput { public ushort key,scan; public uint flags,time; public UIntPtr extra; }
        [StructLayout(LayoutKind.Explicit,Size=32)] struct InputUnion { [FieldOffset(0)] public KeyboardInput keyboard; }
        [StructLayout(LayoutKind.Sequential)] struct Input { public uint type; public InputUnion data; }
        [DllImport("user32.dll",SetLastError=true)] static extern uint SendInput(uint count,Input[] inputs,int size);

        IntPtr job=IntPtr.Zero,process=IntPtr.Zero,thread=IntPtr.Zero;
        bool started=false;
        public uint Pid { get; private set; }
        public string Image { get; private set; }
        public OwnedApp() {
            job=CreateJobObject(IntPtr.Zero,null);
            if(job==IntPtr.Zero) throw new Win32Exception();
            // Constructor cannot create a child. Caller holds this owner before Start.
            try {
                ExtendedLimits limits=new ExtendedLimits(); limits.basic.flags=0x2000|0x8; limits.basic.active=64;
                IntPtr memory=Marshal.AllocHGlobal(Marshal.SizeOf(typeof(ExtendedLimits)));
                try { Marshal.StructureToPtr(limits,memory,false); if(!SetInformationJobObject(job,9,memory,(uint)Marshal.SizeOf(typeof(ExtendedLimits)))) throw new Win32Exception(); }
                finally { Marshal.FreeHGlobal(memory); }
            } catch { CloseHandle(job); job=IntPtr.Zero; throw; }
        }
        // Microsoft CRT argv quoting. No shell, alternate token or supplied environment.
        // Caller supplies only curated native switches and an owned scratch output path.
        static string QuoteArgument(string value) {
            if(value==null||value.Length>4096||value.IndexOf('\0')>=0||value.IndexOf('\r')>=0||value.IndexOf('\n')>=0)
                throw new ArgumentException("Bounded literal argument required");
            StringBuilder quoted=new StringBuilder("\"");
            int slashes=0;
            foreach(char character in value) {
                if(character=='\\') { slashes++; continue; }
                if(character=='\"') {
                    quoted.Append('\\',checked(slashes*2+1));
                    quoted.Append('\"');
                } else {
                    quoted.Append('\\',slashes);
                    quoted.Append(character);
                }
                slashes=0;
            }
            // Trailing slashes must be doubled before the closing quote.
            quoted.Append('\\',checked(slashes*2));
            quoted.Append('\"');
            return quoted.ToString();
        }
        public void Start(string image) { StartCommand(image,new string[0]); }
        public void StartCommand(string image,string[] arguments) {
            if(job==IntPtr.Zero||started) throw new InvalidOperationException("Fresh retained owner required");
            if(arguments==null||arguments.Length>16) throw new ArgumentException("Finite literal argv required");
            Image=Path.GetFullPath(image);
            if(!File.Exists(Image)||Image.IndexOf('\"')>=0) throw new ArgumentException("Exact local image required");
            StringBuilder command=new StringBuilder(QuoteArgument(Image));
            foreach(string argument in arguments) command.Append(' ').Append(QuoteArgument(argument));
            if(command.Length>=32767) throw new ArgumentException("Native command line exceeds UTF-16 limit");
            StartInfo start=new StartInfo(); start.cb=(uint)Marshal.SizeOf(typeof(StartInfo));
            ProcessInfo child;
            if(!CreateProcess(Image,command,IntPtr.Zero,IntPtr.Zero,false,4|0x400,IntPtr.Zero,Path.GetDirectoryName(Image),ref start,out child)) throw new Win32Exception();
            // No fallible work precedes custody attachment after native creation.
            process=child.process; thread=child.thread; Pid=child.pid; started=true;
            if(!AssignProcessToJobObject(job,process)) throw new Win32Exception();
            if(ResumeThread(thread)==UInt32.MaxValue) throw new Win32Exception();
            if(!CloseHandle(thread)) throw new Win32Exception();
            thread=IntPtr.Zero;
            // A failure leaves this already-held owner retryable for explicit cleanup.
        }
        public uint[] Members() {
            if(job==IntPtr.Zero) throw new ObjectDisposedException("OwnedApp");
            IntPtr data=Marshal.AllocHGlobal(8+64*IntPtr.Size);
            try {
                uint returned;
                if(!QueryInformationJobObject(job,3,data,(uint)(8+64*IntPtr.Size),out returned)) throw new Win32Exception();
                int assigned=Marshal.ReadInt32(data),count=Marshal.ReadInt32(data,4);
                if(count<0||count>64||assigned!=count) throw new InvalidOperationException("Finite complete owned job list required");
                uint[] ids=new uint[count];
                for(int i=0;i<count;i++) ids[i]=checked((uint)Marshal.ReadIntPtr(data,8+i*IntPtr.Size).ToInt64());
                return ids;
            } finally { Marshal.FreeHGlobal(data); }
        }
        public string MemberImage(uint pid) {
            bool found=false; foreach(uint id in Members()) if(id==pid) found=true;
            if(!found) throw new InvalidOperationException("Only retained job members may be queried");
            IntPtr handle=OpenProcess(0x1000,false,pid);
            if(handle==IntPtr.Zero) throw new Win32Exception();
            try {
                bool owned; if(!IsProcessInJob(handle,job,out owned)||!owned) throw new InvalidOperationException("Member identity changed");
                uint length=32768; StringBuilder value=new StringBuilder((int)length);
                if(!QueryFullProcessImageName(handle,0,value,ref length)) throw new Win32Exception();
                return value.ToString();
            } finally { CloseHandle(handle); }
        }
        public Member OpenMember(uint pid,string exactImage) {
            bool found=false; foreach(uint id in Members()) if(id==pid) found=true;
            if(!found) throw new InvalidOperationException("Only an owned job member may be opened");
            return new Member(job,pid,exactImage);
        }
        public void KillRoot() { if(process==IntPtr.Zero||!TerminateProcess(process,71)) throw new Win32Exception(); }
        public bool WaitEmpty(int milliseconds) {
            Stopwatch clock=Stopwatch.StartNew();
            while(clock.ElapsedMilliseconds<milliseconds) {
                if(Members().Length==0&&(process==IntPtr.Zero||WaitForSingleObject(process,0)==0)) return true;
                Thread.Sleep(25);
            }
            return false;
        }
        public AutomationElement Window() {
            if(process==IntPtr.Zero||WaitForSingleObject(process,0)==0) throw new InvalidOperationException("Owned app already exited");
            IntPtr hwnd;
            using(Process view=Process.GetProcessById((int)Pid)) { hwnd=view.MainWindowHandle; }
            uint pid; GetWindowThreadProcessId(hwnd,out pid);
            if(hwnd==IntPtr.Zero||pid!=Pid) throw new InvalidOperationException("Owned window unavailable");
            AutomationElement window=AutomationElement.FromHandle(hwnd);
            if(window.Current.ProcessId!=(int)Pid) throw new InvalidOperationException("Window ownership changed");
            return window;
        }
        public string[] Names() {
            AutomationElement window=Window();
            AutomationElementCollection nodes=window.FindAll(TreeScope.Subtree,Condition.TrueCondition);
            if(nodes.Count>2048) throw new InvalidOperationException("Owned accessibility tree exceeds bound");
            HashSet<uint> ids=new HashSet<uint>(Members()); List<string> names=new List<string>();
            foreach(AutomationElement node in nodes) {
                if(!ids.Contains((uint)node.Current.ProcessId)) throw new InvalidOperationException("Accessibility node outside retained job");
                string name=node.Current.Name;
                if(name.Length>8192) throw new InvalidOperationException("Accessibility text exceeds bound");
                names.Add(name);
            }
            return names.ToArray();
        }
        AutomationElement OwnedControl(string name) {
            if(String.IsNullOrEmpty(name)||name.Length>256) throw new ArgumentException("Finite exact control name required");
            AutomationElement element=Window().FindFirst(TreeScope.Descendants,new PropertyCondition(AutomationElement.NameProperty,name));
            if(element==null) throw new InvalidOperationException("Owned control unavailable: "+name);
            HashSet<uint> ids=new HashSet<uint>(Members());
            if(!ids.Contains((uint)element.Current.ProcessId)||!element.Current.IsEnabled) throw new InvalidOperationException("Owned control unavailable");
            return element;
        }
        public void Expand(string name) {
            AutomationElement element=OwnedControl(name);
            object pattern;
            if(!element.TryGetCurrentPattern(ExpandCollapsePattern.Pattern,out pattern)) throw new InvalidOperationException("Owned control has no native expansion pattern");
            ExpandCollapsePattern menu=(ExpandCollapsePattern)pattern;
            if(menu.Current.ExpandCollapseState==ExpandCollapseState.LeafNode) throw new InvalidOperationException("Owned control is not expandable");
            if(menu.Current.ExpandCollapseState!=ExpandCollapseState.Expanded) menu.Expand();
        }
        public void Invoke(string name) {
            AutomationElement element=OwnedControl(name);
            object pattern;
            if(!element.TryGetCurrentPattern(InvokePattern.Pattern,out pattern)) throw new InvalidOperationException("Owned control has no native invocation pattern");
            ((InvokePattern)pattern).Invoke();
        }
        // Closed key sequences only, in this isolated guest's retained foreground window.
        void Keys(bool quit) {
            AutomationElement window=Window(); IntPtr hwnd=new IntPtr(window.Current.NativeWindowHandle);
            if(!SetForegroundWindow(hwnd)||GetForegroundWindow()!=hwnd) throw new InvalidOperationException("Owned keyboard foreground acknowledgment required");
            if(!quit) {
                AutomationElement button=OwnedControl("Check again"); button.SetFocus();
                AutomationElement focused=AutomationElement.FocusedElement;
                if(focused==null||focused.Current.Name!="Check again"||!new HashSet<uint>(Members()).Contains((uint)focused.Current.ProcessId)) throw new InvalidOperationException("Owned button focus required");
            }
            ushort[] keys=quit?new ushort[]{0x11,0x51,0x51,0x11}:new ushort[]{0x0D,0x0D};
            Input[] sequence=new Input[keys.Length];
            for(int i=0;i<keys.Length;i++) { sequence[i].type=1; sequence[i].data.keyboard.key=keys[i]; sequence[i].data.keyboard.flags=(uint)(i>=keys.Length/2?2:0); }
            if(GetForegroundWindow()!=hwnd) throw new InvalidOperationException("Owned foreground changed before fixed key sequence");
            if(Marshal.SizeOf(typeof(Input))!=40||SendInput((uint)sequence.Length,sequence,40)!=(uint)sequence.Length) throw new Win32Exception();
        }
        public void KeyboardCheckAgain() { Keys(false); }
        public void KeyboardQuit() { Keys(true); }
        public void CloseWindow() { ((WindowPattern)Window().GetCurrentPattern(WindowPattern.Pattern)).Close(); }
        public void Capture(string path) {
            AutomationElement window=Window(); IntPtr hwnd=new IntPtr(window.Current.NativeWindowHandle);
            if(!SetForegroundWindow(hwnd)||GetForegroundWindow()!=hwnd) throw new InvalidOperationException("Actual owned foreground window required for capture");
            System.Windows.Rect r=window.Current.BoundingRectangle;
            if(r.Width<640||r.Height<480||r.Width>1920||r.Height>1200) throw new InvalidOperationException("Owned window capture geometry outside bounds");
            using(System.Drawing.Bitmap image=new System.Drawing.Bitmap((int)r.Width,(int)r.Height))
            using(System.Drawing.Graphics graphics=System.Drawing.Graphics.FromImage(image)) {
                graphics.CopyFromScreen((int)r.X,(int)r.Y,0,0,image.Size);
                image.Save(path,System.Drawing.Imaging.ImageFormat.Png);
            }
        }
        public void Dispose() {
            if(job==IntPtr.Zero) return;
            // Covers both assigned children and a suspended pre-assignment failure.
            if(process!=IntPtr.Zero&&WaitForSingleObject(process,0)!=0&&!TerminateProcess(process,72)) throw new Win32Exception();
            if(!TerminateJobObject(job,72)) throw new Win32Exception();
            if(!WaitEmpty(6000)) throw new InvalidOperationException("Retained owned job failed to drain");
            if(thread!=IntPtr.Zero) { if(!CloseHandle(thread)) throw new Win32Exception(); thread=IntPtr.Zero; }
            if(process!=IntPtr.Zero) { if(!CloseHandle(process)) throw new Win32Exception(); process=IntPtr.Zero; }
            if(!CloseHandle(job)) throw new Win32Exception();
            job=IntPtr.Zero;
        }
        public sealed class Member : IDisposable {
            IntPtr handle;
            public uint Pid { get; private set; }
            public long CreationTime { get; private set; }
            public string Path { get; private set; }
            internal Member(IntPtr owner,uint pid,string image) {
                handle=OpenProcess(0x1000|0x100000|1,false,pid);
                if(handle==IntPtr.Zero) throw new Win32Exception();
                try {
                    bool member; if(!IsProcessInJob(handle,owner,out member)||!member) throw new InvalidOperationException("Opened process is not in retained job");
                    uint length=32768; StringBuilder path=new StringBuilder((int)length);
                    if(!QueryFullProcessImageName(handle,0,path,ref length)) throw new Win32Exception();
                    Path=path.ToString();
                    if(!String.Equals(Path,System.IO.Path.GetFullPath(image),StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("Owned executable path mismatch");
                    FileTime created,exited,kernel,user; if(!GetProcessTimes(handle,out created,out exited,out kernel,out user)) throw new Win32Exception();
                    CreationTime=((long)created.high<<32)|created.low; Pid=pid;
                } catch { CloseHandle(handle); handle=IntPtr.Zero; throw; }
            }
            public void Kill() { if(handle==IntPtr.Zero||!TerminateProcess(handle,73)) throw new Win32Exception(); }
            public bool Exited { get { return handle!=IntPtr.Zero&&WaitForSingleObject(handle,0)==0; } }
            public void Dispose() { if(handle!=IntPtr.Zero) { if(!CloseHandle(handle)) throw new Win32Exception(); handle=IntPtr.Zero; } }
        }
    }
}
