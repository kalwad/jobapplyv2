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
        // Official UIAutomationClient.h IUnknown prefixes. Unused slots preserve ABI;
        // the only UIA root query used below is ElementFromHandle(our retained HWND).
        [StructLayout(LayoutKind.Sequential)] struct NativePoint { public int x,y; }
        [ComImport,Guid("352ffba8-0973-437c-a61f-f64cafd81df9"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface NativeCondition { }
        [ComImport,Guid("30cbe57d-d9d0-452a-ab13-7ac5ac4825ee"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface NativeAutomation {
            [PreserveSig] int CompareElements(NativeElement first,NativeElement second,out int same);
            [PreserveSig] int CompareRuntimeIds(IntPtr first,IntPtr second,out int same);
            [PreserveSig] int GetRootElement(out NativeElement root);
            [PreserveSig] int ElementFromHandle(IntPtr hwnd,out NativeElement root);
            [PreserveSig] int ElementFromPoint(NativePoint point,out NativeElement element);
            [PreserveSig] int GetFocusedElement(out NativeElement element);
            [PreserveSig] int GetRootElementBuildCache(IntPtr cache,out NativeElement root);
            [PreserveSig] int ElementFromHandleBuildCache(IntPtr hwnd,IntPtr cache,out NativeElement element);
            [PreserveSig] int ElementFromPointBuildCache(NativePoint point,IntPtr cache,out NativeElement element);
            [PreserveSig] int GetFocusedElementBuildCache(IntPtr cache,out NativeElement element);
            [PreserveSig] int CreateTreeWalker(NativeCondition condition,out IntPtr walker);
            [PreserveSig] int get_ControlViewWalker(out IntPtr walker);
            [PreserveSig] int get_ContentViewWalker(out IntPtr walker);
            [PreserveSig] int get_RawViewWalker(out IntPtr walker);
            [PreserveSig] int get_RawViewCondition(out NativeCondition condition);
            [PreserveSig] int get_ControlViewCondition(out NativeCondition condition);
            [PreserveSig] int get_ContentViewCondition(out NativeCondition condition);
            [PreserveSig] int CreateCacheRequest(out IntPtr cache);
            [PreserveSig] int CreateTrueCondition(out NativeCondition condition);
        }
        [ComImport,Guid("d22108aa-8ac5-49a5-837b-37bbb3d7591e"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface NativeElement {
            [PreserveSig] int SetFocus();
            [PreserveSig] int GetRuntimeId([MarshalAs(UnmanagedType.SafeArray,SafeArraySubType=VarEnum.VT_I4)] out int[] runtimeId);
            [PreserveSig] int FindFirst(int scope,NativeCondition condition,out NativeElement element);
            [PreserveSig] int FindAll(int scope,NativeCondition condition,out NativeElements elements);
            [PreserveSig] int FindFirstBuildCache(int scope,NativeCondition condition,IntPtr cache,out NativeElement element);
            [PreserveSig] int FindAllBuildCache(int scope,NativeCondition condition,IntPtr cache,out NativeElements elements);
            [PreserveSig] int BuildUpdatedCache(IntPtr cache,out NativeElement element);
            [PreserveSig] int GetCurrentPropertyValue(int property,[MarshalAs(UnmanagedType.Struct)] out object value);
            [PreserveSig] int GetCurrentPropertyValueEx(int property,int ignoreDefault,[MarshalAs(UnmanagedType.Struct)] out object value);
        }
        [ComImport,Guid("14314595-b4bc-4055-95f2-58f2e42c9855"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface NativeElements {
            [PreserveSig] int get_Length(out int length);
            [PreserveSig] int GetElement(int index,out NativeElement element);
        }
        // BEGIN PURE NATIVE ROLE DATA: exercised without loading any UIA/COM type.
        sealed class NativeRoleRecord {
            public readonly int ProcessId;
            public readonly string Role;
            public NativeRoleRecord(int processId,string role) { ProcessId=processId;Role=role; }
        }
        static string NativeRuntimeKey(int[] runtimeId) {
            if(runtimeId==null||runtimeId.Length<1||runtimeId.Length>64) throw new InvalidOperationException("Finite exact native runtime ID required");
            string[] parts=new string[runtimeId.Length];
            for(int i=0;i<parts.Length;i++) parts[i]=runtimeId[i].ToString(System.Globalization.CultureInfo.InvariantCulture);
            return String.Join(",",parts);
        }
        static string NativeRoleString(object value) {
            string text=value as string;
            if(text==null||text.Length==0) return null; // Unknown is data, never a substitute role.
            if(text.Length>128) throw new InvalidOperationException("Bounded actual ARIA role required");
            return text;
        }
        static void AddNativeRole(Dictionary<string,NativeRoleRecord> rows,int[] runtimeId,int processId,string role) {
            if(processId<=0||rows.Count>=2048) throw new InvalidOperationException("Finite actual native role inventory required");
            string key=NativeRuntimeKey(runtimeId);
            if(rows.ContainsKey(key)) throw new InvalidOperationException("Ambiguous native runtime ID refused");
            rows.Add(key,new NativeRoleRecord(processId,role));
        }
        static string BindNativeRole(Dictionary<string,NativeRoleRecord> rows,int[] runtimeId,int processId,bool required) {
            NativeRoleRecord row;
            if(processId<=0||!rows.TryGetValue(NativeRuntimeKey(runtimeId),out row)||row.ProcessId!=processId) throw new InvalidOperationException("Managed/native owned element identity differs");
            if(required&&row.Role==null) throw new InvalidOperationException("Required actual ARIA role is unsupported");
            return row.Role;
        }
        // END PURE NATIVE ROLE DATA.
        sealed class NativeRoleSnapshot {
            public readonly IntPtr Hwnd;
            public readonly string RootKey;
            public readonly Dictionary<string,NativeRoleRecord> Rows;
            public NativeRoleSnapshot(IntPtr hwnd,string rootKey,Dictionary<string,NativeRoleRecord> rows) { Hwnd=hwnd;RootKey=rootKey;Rows=rows; }
        }
        static void NativeSuccess(int result) {
            if(result!=0) throw new COMException("Owned UIAutomation operation did not return S_OK",result);
        }
        static object NativeValue(NativeElement element,int property,List<object> acquired) {
            object value;int result=element.GetCurrentPropertyValueEx(property,1,out value);
            if(value!=null&&Marshal.IsComObject(value)) acquired.Add(value);
            NativeSuccess(result);
            return value;
        }
        static int NativeProcessId(NativeElement element,List<object> acquired) {
            object value=NativeValue(element,30002,acquired);
            if(!(value is int)||(int)value<=0) throw new InvalidOperationException("Actual native process ID unavailable");
            return (int)value;
        }
        static string NativeKey(NativeElement element) { int[] id;NativeSuccess(element.GetRuntimeId(out id));return NativeRuntimeKey(id); }
        static void ReleaseNativeObjects(List<object> acquired,Exception primary) {
            List<Exception> errors=new List<Exception>();
            if(primary!=null) errors.Add(primary);
            for(int i=acquired.Count-1;i>=0;i--) {
                try { Marshal.ReleaseComObject(acquired[i]); }
                catch(Exception error) { errors.Add(error); }
            }
            if(errors.Count>(primary==null?0:1)) throw new AggregateException("Owned UIAutomation COM release is unsettled",errors);
        }
        NativeRoleSnapshot NativeRoles() {
            AutomationElement window=Window();IntPtr hwnd=new IntPtr(window.Current.NativeWindowHandle);string rootKey=NativeRuntimeKey(window.GetRuntimeId());
            HashSet<uint> members=new HashSet<uint>(Members());List<object> acquired=new List<object>();Exception primary=null;
            try {
                Type nativeType=Type.GetTypeFromCLSID(new Guid("ff48dba4-60ef-4201-aa87-54103eef594e"),true);
                object instance=Activator.CreateInstance(nativeType);acquired.Add(instance);NativeAutomation automation=(NativeAutomation)instance;
                NativeElement root;int result=automation.ElementFromHandle(hwnd,out root);if(root!=null) acquired.Add(root);NativeSuccess(result);if(root==null) throw new InvalidOperationException("Actual owned UIA root unavailable");
                object rootHandle=NativeValue(root,30020,acquired);
                if(NativeProcessId(root,acquired)!=(int)Pid||!(rootHandle is int)||new IntPtr((int)rootHandle)!=hwnd||NativeKey(root)!=rootKey) throw new InvalidOperationException("Native root escaped retained HWND/PID/runtime ID");
                NativeCondition condition;result=automation.CreateTrueCondition(out condition);if(condition!=null) acquired.Add(condition);NativeSuccess(result);if(condition==null) throw new InvalidOperationException("Actual native condition unavailable");
                NativeElements nodes;result=root.FindAll(7,condition,out nodes);if(nodes!=null) acquired.Add(nodes);NativeSuccess(result);if(nodes==null) throw new InvalidOperationException("Actual owned native subtree unavailable");
                int count;NativeSuccess(nodes.get_Length(out count));if(count<1||count>2048) throw new InvalidOperationException("Owned native subtree exceeds bound");
                Dictionary<string,NativeRoleRecord> rows=new Dictionary<string,NativeRoleRecord>(StringComparer.Ordinal);
                for(int i=0;i<count;i++) {
                    NativeElement node;result=nodes.GetElement(i,out node);if(node!=null) acquired.Add(node);NativeSuccess(result);if(node==null) throw new InvalidOperationException("Actual native element unavailable");
                    int processId=NativeProcessId(node,acquired);if(!members.Contains((uint)processId)) throw new InvalidOperationException("Native role node outside retained job");
                    int[] id;NativeSuccess(node.GetRuntimeId(out id));object role=NativeValue(node,30101,acquired);
                    AddNativeRole(rows,id,processId,NativeRoleString(role));
                    if(NativeKey(node)!=NativeRuntimeKey(id)||NativeProcessId(node,acquired)!=processId) throw new InvalidOperationException("Native element changed during ARIA observation");
                }
                AutomationElement after=Window();
                if(new IntPtr(after.Current.NativeWindowHandle)!=hwnd||NativeRuntimeKey(after.GetRuntimeId())!=rootKey||!rows.ContainsKey(rootKey)) throw new InvalidOperationException("Owned root changed during native ARIA snapshot");
                return new NativeRoleSnapshot(hwnd,rootKey,rows);
            } catch(Exception error) { primary=error;throw; }
            finally { ReleaseNativeObjects(acquired,primary); }
        }
        string ReadNativeRole(AutomationElement node,NativeRoleSnapshot snapshot,bool required) {
            AutomationElement root=Window();if(new IntPtr(root.Current.NativeWindowHandle)!=snapshot.Hwnd||NativeRuntimeKey(root.GetRuntimeId())!=snapshot.RootKey) throw new InvalidOperationException("Retained root changed before managed/native role join");
            int processId=node.Current.ProcessId;int[] id=node.GetRuntimeId();
            if(processId<=0||!new HashSet<uint>(Members()).Contains((uint)processId)) throw new InvalidOperationException("Managed ARIA query outside retained job");
            string role=BindNativeRole(snapshot.Rows,id,processId,required);
            if(node.Current.ProcessId!=processId||NativeRuntimeKey(node.GetRuntimeId())!=NativeRuntimeKey(id)) throw new InvalidOperationException("Managed element changed during ARIA join");
            root=Window();if(new IntPtr(root.Current.NativeWindowHandle)!=snapshot.Hwnd||NativeRuntimeKey(root.GetRuntimeId())!=snapshot.RootKey) throw new InvalidOperationException("Retained root changed after managed/native role join");
            return role;
        }
        static readonly string[] ShellRoutes={"Home","Jobs","Tracker","Documents / Resumes","Profile","Settings","Diagnostics"};
        [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr hwnd);
        [DllImport("user32.dll")] static extern IntPtr GetWindowDpiAwarenessContext(IntPtr hwnd);
        [DllImport("user32.dll")] static extern int GetAwarenessFromDpiAwarenessContext(IntPtr context);
        [DllImport("user32.dll")] static extern IntPtr GetKeyboardLayout(uint thread);
        void ShellForeground() {
            AutomationElement window=Window(); IntPtr hwnd=new IntPtr(window.Current.NativeWindowHandle);
            if(!SetForegroundWindow(hwnd)||GetForegroundWindow()!=hwnd) throw new InvalidOperationException("Owned shell foreground acknowledgment required");
        }
        AutomationElement ShellUnique(string name,ControlType type,string role,bool requireVisible=true) {
            AutomationElementCollection nodes=Window().FindAll(TreeScope.Descendants,new PropertyCondition(AutomationElement.NameProperty,name));
            if(nodes.Count>32) throw new InvalidOperationException("Finite exact shell query required");
            HashSet<uint> ids=new HashSet<uint>(Members()); AutomationElement found=null;
            NativeRoleSnapshot roles=role==null?null:NativeRoles();
            foreach(AutomationElement node in nodes) {
                if(!ids.Contains((uint)node.Current.ProcessId)) throw new InvalidOperationException("Shell node outside retained job");
                string actualRole=roles==null?null:ReadNativeRole(node,roles,false);
                if(node.Current.ControlType!=type||(role!=null&&actualRole!=role)) continue;
                if(found!=null) throw new InvalidOperationException("Unique exact native shell element required");
                found=node;
            }
            if(found==null||!found.Current.IsEnabled||(requireVisible&&found.Current.IsOffscreen)) throw new InvalidOperationException("Visible exact owned shell element unavailable");
            return found;
        }
        public void ShellFocusRoute(string label) {
            if(Array.IndexOf(ShellRoutes,label)<0) throw new ArgumentException("Closed source-bound route required");
            ShellForeground(); AutomationElement link=ShellUnique(label,ControlType.Hyperlink,null,false);link.SetFocus();
            if(!link.Current.HasKeyboardFocus) throw new InvalidOperationException("Owned route link focus unavailable");
        }
        public void ShellFocusSkip() {
            ShellForeground();AutomationElement link=ShellUnique("Skip to main content",ControlType.Hyperlink,null,false);link.SetFocus();
            if(!link.Current.HasKeyboardFocus||link.Current.IsOffscreen) throw new InvalidOperationException("Actual skip link focus unavailable");
        }
        public bool ShellMainFocused() {
            AutomationElementCollection nodes=Window().FindAll(TreeScope.Descendants,Condition.TrueCondition);
            if(nodes.Count>2048) throw new InvalidOperationException("Finite owned shell tree required");
            HashSet<uint> ids=new HashSet<uint>(Members());int count=0;NativeRoleSnapshot roles=NativeRoles();
            foreach(AutomationElement node in nodes) {
                if(!ids.Contains((uint)node.Current.ProcessId)) throw new InvalidOperationException("Shell node outside retained job");
                if(ReadNativeRole(node,roles,false)=="main"&&node.Current.HasKeyboardFocus) count++;
            }
            return count==1;
        }
        public bool ShellRouteLinkFocused(string label) {
            if(Array.IndexOf(ShellRoutes,label)<0) throw new ArgumentException("Closed source-bound route required");
            return ShellUnique(label,ControlType.Hyperlink,null,false).Current.HasKeyboardFocus;
        }
        public bool ShellRouteFocused(string label) {
            if(Array.IndexOf(ShellRoutes,label)<0) throw new ArgumentException("Closed source-bound route required");
            AutomationElement heading=ShellUnique(label,ControlType.Text,"heading");
            ShellUnique(label,ControlType.Hyperlink,null,false);
            return heading.Current.HasKeyboardFocus;
        }
        public void ShellKeys(string operation) {
            ushort[] keys;
            switch(operation) {
                case "enter":keys=new ushort[]{0x0D};break;
                case "tab":keys=new ushort[]{0x09};break;
                case "backtab":keys=new ushort[]{0x10,0x09};break;
                case "reset":keys=new ushort[]{0x11,0x30};break;
                case "zoom":keys=new ushort[]{0x11,0x10,0xBB};break;
                default:throw new ArgumentException("Closed native shell chord required");
            }
            ShellForeground();AutomationElement window=Window();IntPtr hwnd=new IntPtr(window.Current.NativeWindowHandle);uint pid;
            uint threadId=GetWindowThreadProcessId(hwnd,out pid);
            if(pid!=Pid||(GetKeyboardLayout(threadId).ToInt64()&0xffff)!=0x0409) throw new InvalidOperationException("Actual owned en-US keyboard layout required for fixed chords");
            Input[] sequence=new Input[keys.Length*2];
            for(int i=0;i<keys.Length;i++) {
                sequence[i].type=1;sequence[i].data.keyboard.key=keys[i];
                sequence[keys.Length+i].type=1;sequence[keys.Length+i].data.keyboard.key=keys[keys.Length-i-1];sequence[keys.Length+i].data.keyboard.flags=2;
            }
            if(GetForegroundWindow()!=hwnd||Marshal.SizeOf(typeof(Input))!=40||SendInput((uint)sequence.Length,sequence,40)!=(uint)sequence.Length) throw new Win32Exception();
        }
        public object[] ShellTree() {
            AutomationElementCollection nodes=Window().FindAll(TreeScope.Subtree,Condition.TrueCondition);
            if(nodes.Count>2048) throw new InvalidOperationException("Finite owned shell tree required");
            HashSet<uint> ids=new HashSet<uint>(Members());List<object> rows=new List<object>();NativeRoleSnapshot roles=NativeRoles();
            foreach(AutomationElement node in nodes) {
                if(!ids.Contains((uint)node.Current.ProcessId)||node.Current.Name.Length>8192) throw new InvalidOperationException("Bounded owned shell node required");
                System.Windows.Rect r=node.Current.BoundingRectangle;
                rows.Add(new Dictionary<string,object>{{"name",node.Current.Name},{"control_type",node.Current.ControlType.ProgrammaticName},{"aria_role",ReadNativeRole(node,roles,false)},{"focused",node.Current.HasKeyboardFocus},{"offscreen",node.Current.IsOffscreen},{"rect",new double[]{r.X,r.Y,r.Width,r.Height}}});
            }
            return rows.ToArray();
        }
        System.Windows.Automation.Text.TextPatternRange ShellText(string text,System.Windows.Automation.Text.TextPatternRange scope) {
            System.Windows.Automation.Text.TextPatternRange first=scope.FindText(text,false,false),last=scope.FindText(text,true,false);
            if(first==null||last==null||!first.Compare(last)||first.GetText(text.Length+1)!=text) throw new InvalidOperationException("Exact unique whole glyph label required");
            if(!(first.GetAttributeValue(TextPattern.IsHiddenAttribute) is bool)||(bool)first.GetAttributeValue(TextPattern.IsHiddenAttribute)) throw new InvalidOperationException("Actual glyph range is hidden or unknown");
            if(!new HashSet<uint>(Members()).Contains((uint)first.GetEnclosingElement().Current.ProcessId)) throw new InvalidOperationException("Glyph range outside retained job");
            return first;
        }
        public Dictionary<string,object> ShellRouteGeometry(string label) {
            AutomationElement heading=ShellUnique(label,ControlType.Text,"heading");
            AutomationElement window=Window();IntPtr hwnd=new IntPtr(window.Current.NativeWindowHandle);
            AutomationElementCollection documents=window.FindAll(TreeScope.Descendants,new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.Document));
            if(documents.Count!=1||!new HashSet<uint>(Members()).Contains((uint)documents[0].Current.ProcessId)) throw new InvalidOperationException("One actual owned native text provider required");
            object raw;if(!documents[0].TryGetCurrentPattern(TextPattern.Pattern,out raw)) throw new InvalidOperationException("Actual UIA text bounds unavailable");
            string text=label.Substring(0,4);
            System.Windows.Automation.Text.TextPatternRange range=((TextPattern)raw).RangeFromChild(heading).FindText(text,false,false);
            if(range==null||range.GetText(5)!=text||!(range.GetAttributeValue(TextPattern.IsHiddenAttribute) is bool)||(bool)range.GetAttributeValue(TextPattern.IsHiddenAttribute)) throw new InvalidOperationException("Actual visible route glyph range unavailable");
            System.Windows.Rect[] rectangles=range.GetBoundingRectangles();if(rectangles.Length!=1) throw new InvalidOperationException("Route prefix must be one complete visible line");
            System.Windows.Rect glyph=rectangles[0];double[] glyphBounds=new double[]{glyph.X,glyph.Y,glyph.Width,glyph.Height};
            uint dpi=GetDpiForWindow(hwnd);int awareness=GetAwarenessFromDpiAwarenessContext(GetWindowDpiAwarenessContext(hwnd));
            if(dpi==0||awareness!=2) throw new InvalidOperationException("Actual per-monitor owned-window DPI required");
            System.Windows.Rect frame=window.Current.BoundingRectangle;
            return new Dictionary<string,object>{{"glyph",new Dictionary<string,object>{{"text",text},{"rect",glyphBounds},{"single_line",true},{"visible",true},{"showing",true}}},{"frame",new double[]{frame.X,frame.Y,frame.Width,frame.Height}},{"window_id",hwnd.ToInt64().ToString()},{"app_pid",Pid},{"backing",new Dictionary<string,object>{{"kind","WIN32_OWNED_HWND"},{"dpi",dpi},{"awareness",awareness}}}};
        }
        public Dictionary<string,object> ShellMeasure(string stage) {
            if(Array.IndexOf(new string[]{"baseline","step1","step2","step3","step4","step5","reset"},stage)<0) throw new ArgumentException("Closed scale measurement stage required");
            ShellForeground();AutomationElement window=Window();IntPtr hwnd=new IntPtr(window.Current.NativeWindowHandle);
            AutomationElementCollection documents=window.FindAll(TreeScope.Descendants,new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.Document));
            if(documents.Count!=1||!new HashSet<uint>(Members()).Contains((uint)documents[0].Current.ProcessId)) throw new InvalidOperationException("One actual owned native text provider required");
            object raw;if(!documents[0].TryGetCurrentPattern(TextPattern.Pattern,out raw)) throw new InvalidOperationException("Actual UIA text bounds unavailable");
            TextPattern pattern=(TextPattern)raw;
            AutomationElement region=ShellUnique("Desktop versions",ControlType.Group,"region");
            System.Windows.Automation.Text.TextPatternRange scope=pattern.RangeFromChild(region);
            ShellText("App version",scope).ScrollIntoView(true);ShellText("Tauri version",scope);
            List<object> anchors=new List<object>();
            foreach(string text in new string[]{"0.0.1","2.12.4"}) {
                System.Windows.Automation.Text.TextPatternRange range=ShellText(text,scope);System.Windows.Rect[] rectangles=range.GetBoundingRectangles();
                if(rectangles.Length!=1) throw new InvalidOperationException("Single visible complete glyph rectangle required");
                System.Windows.Rect glyph=rectangles[0];double[] glyphBounds=new double[]{glyph.X,glyph.Y,glyph.Width,glyph.Height};
                foreach(double coordinate in glyphBounds) if(Double.IsNaN(coordinate)||Double.IsInfinity(coordinate)) throw new InvalidOperationException("Finite actual glyph bounds required");
                anchors.Add(new Dictionary<string,object>{{"text",text},{"rect",glyphBounds},{"single_line",true},{"visible",true},{"showing",true}});
            }
            uint dpi=GetDpiForWindow(hwnd);IntPtr context=GetWindowDpiAwarenessContext(hwnd);int awareness=GetAwarenessFromDpiAwarenessContext(context);
            if(dpi==0||context==IntPtr.Zero||awareness!=2) throw new InvalidOperationException("Actual per-monitor owned-window DPI required");
            System.Windows.Rect frame=window.Current.BoundingRectangle;
            return new Dictionary<string,object>{{"stage",stage},{"window_id",hwnd.ToInt64().ToString()},{"app_pid",Pid},{"frame",new double[]{frame.X,frame.Y,frame.Width,frame.Height}},{"backing",new Dictionary<string,object>{{"kind","WIN32_OWNED_HWND"},{"dpi",dpi},{"awareness",awareness}}},{"anchors",anchors.ToArray()}};
        }
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
