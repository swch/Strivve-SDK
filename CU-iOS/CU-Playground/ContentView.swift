import SwiftUI
import WebKit

struct ContentView: View {
    @State private var textFieldValue: String = ""
    @State private var selection: Int = 0
    @State public var presentationMode: UIModalPresentationStyle = .fullScreen
    
    var htmlString : String = ""
 
    // Default spacing for different element types
    var defaultPadding = 20.0
    var mediumPadding = 10.0
    var narrowPadding = 5.0
    var pickerPadding = 100.0
    var pickerScale = 0.8
    var defaultHeaderPadding = -5.0
    
    // Define default settings for the configuration options
        // Container Settings
        @State public var showCloseButton = true
    
        // CardUpdatr Settings
    
            // topSites must be comma delimited without spaces for this demo
            @State private var topSites: String = "spotify.com,statefarm.com,starbucks.com"
        
            // Two settings to condider here:
            //     1) synthetic -> ability to test the UX of the different merchant site credetntial entry flows
            //     2) prod -> all production sites available
            @State public var merchantSiteTags: String = "synthetic"
        
            // any hex value to set the color of the Button within CardUpdatr along with the color of the Toolbar text
            @State public var buttonColor: String = "#1A2A6C"
        
    var body: some View {
        VStack {
            VStack(alignment: .center) {
                Text("CardUpdatr")
                    .font(.title)
                    .fontWeight(.bold)
                Text("Playground")
                    .font(.subheadline)
                    .fontWeight(.bold)
            }
            .padding(.top, 0) // Removes top spacing
            .padding(defaultPadding * 2)
            
            Text("Overlay Integration Demo")
                .font(.subheadline)
                .fontWeight(.bold)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(defaultPadding)
                            
            VStack {
                VStack(alignment: .leading) {
                    Text("Top Sites (comma,no spaces)")
                        .padding(.bottom, defaultHeaderPadding)
                        .font(.callout)
                    TextField("", text: $topSites)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .keyboardType(.default)
                        .autocapitalization(.none)
                        .disableAutocorrection(true)
                        .foregroundColor(Color.black)
                }
                
                VStack(alignment: .leading) {
                    Text("Merchant Site Tags (e.g. prod)")
                        .padding(.bottom, defaultHeaderPadding)
                        .font(.callout)
                    TextField("", text: $merchantSiteTags)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .keyboardType(.default)
                        .autocapitalization(.none)
                        .disableAutocorrection(true)
                        .foregroundColor(Color.black)
                }
                
                VStack(alignment: .leading) {
                    Text("Button Color # (e.g. #00FF00)")
                        .padding(.bottom, defaultHeaderPadding)
                        .font(.callout)
                    TextField("", text: $buttonColor)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .keyboardType(.default)
                        .autocapitalization(.none)
                        .disableAutocorrection(true)
                        .foregroundColor(Color.black)
                }
            }
            .padding(.horizontal, defaultPadding)
            
                var disableCloseButtonToggle: Bool {
                    presentationMode == .overCurrentContext
                }
                
                VStack() {
                    Text("WebKit PresentationMode")
                        .font(.subheadline)
                        .fontWeight(.bold)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, defaultPadding)
                        .padding(.horizontal, defaultPadding)
                    
                    Picker(selection: $presentationMode, label: Text("")) {
                        Text(".popover").tag(UIModalPresentationStyle.fullScreen)
                        Text(".overCurrentContext").tag(UIModalPresentationStyle.overCurrentContext)
                    }
                    .pickerStyle(SegmentedPickerStyle())
                    .padding(.top, defaultHeaderPadding)
                    .padding(.horizontal, defaultPadding)
                    .onChange(of: presentationMode) { newValue in
                        showCloseButton = true
                    }
                    
                    HStack(alignment: .center) {
                        Toggle(isOn: $showCloseButton) {
                            Text("Show Toolbar?")
                                .font(.callout)
                                .fontWeight(.bold)
                        }
                        .pickerStyle(InlinePickerStyle())
                        .disabled(disableCloseButtonToggle) // Disable the toggle based on computed property
                    }
                    .padding(.top, narrowPadding)
                    .padding(.horizontal, pickerPadding)
                    .scaleEffect(pickerScale)
                    
                }
                
                Button(action: {
                    let htmlString = generateCardUpdatrURL(topSites: topSites, merchantSiteTags: merchantSiteTags, buttonColor: buttonColor, showCloseButton: showCloseButton)
                    
                    let webView = WKWebView()
                    webView.loadHTMLString(htmlString, baseURL: URL(string: "https://barclays.customer-dev.cardupdatr.app/")?.deletingLastPathComponent())

// presentation mode set via UIModalPresentationStyle set to .popover shows the underling app that loaded CardUpdatr

                    if presentationMode == UIModalPresentationStyle.fullScreen {
                        let hostingController = UIHostingController(rootView: WebViewContainer(webView: webView, showCloseButton: showCloseButton, buttonColor: buttonColor))
                        hostingController.modalPresentationStyle = .popover
                        
                        if let windowScene = UIApplication.shared.connectedScenes.first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene {
                            if let window = windowScene.windows.first(where: { $0.isKeyWindow }) {
                                window.rootViewController?.present(hostingController, animated: true, completion: nil)
                            }
                        }
                        
// presentation mode set via UIModalPresentationStyle set to .overCurrentContext, and then set to the maximum size of the phone's screen
                        
                    } else if presentationMode == UIModalPresentationStyle.overCurrentContext {
                        let hostingController = UIHostingController(rootView: WebViewContainer(webView: webView, showCloseButton: showCloseButton, buttonColor: buttonColor))
                        hostingController.modalPresentationStyle = .overCurrentContext
                        
                        if let windowScene = UIApplication.shared.connectedScenes.first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene {
                            if let window = windowScene.windows.first(where: { $0.isKeyWindow }) {
                                window.rootViewController?.present(hostingController, animated: true, completion: nil)
                            }
                        }
                    }
                }) {
                    Text("Launch WKWebview")
                        .foregroundColor(.white)
                        .padding(.vertical, 12)
                        .padding(.horizontal, 24)
                        .background(Color.blue)
                        .cornerRadius(6)
                }
                Spacer()
        } // Primary VStack
    } // Body
} // ContentView Struct


struct WebView: UIViewRepresentable {
    let htmlString: String
    
    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView()
        return webView
    }
    
    func updateUIView(_ uiView: WKWebView, context: Context) {
        let baseURL = URL(string: "https://barclays.customer-dev.cardupdatr.app/")?.deletingLastPathComponent()
        uiView.loadHTMLString(htmlString, baseURL: baseURL)
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }
    
    class Coordinator: NSObject, WKNavigationDelegate, UIScrollViewDelegate {
        func scrollViewWillBeginZooming(_ scrollView: UIScrollView, with view: UIView?) {
            scrollView.maximumZoomScale = 1.0
            scrollView.minimumZoomScale = 1.0
        }
    }
    
}


struct WebViewContainer: UIViewControllerRepresentable {
    var webView: WKWebView
    var showCloseButton: Bool = true
    var buttonColor: String
    
    func makeUIViewController(context: Context) -> UIViewController {
        let viewController = UIViewController()
        viewController.view = webView
        
        if showCloseButton {
            let buttonTitleColor = UIColor(hex: buttonColor)
            let doneButton = UIBarButtonItem(title: "Close", style: .plain, target: context.coordinator, action: #selector(Coordinator.dismiss))
            doneButton.tintColor = buttonTitleColor

            let toolbar = UIToolbar(frame: CGRect(x: 0, y: 0, width: UIScreen.main.bounds.width, height: 44))
            toolbar.items = [UIBarButtonItem(barButtonSystemItem: .flexibleSpace, target: nil, action: nil), doneButton]
            viewController.view.addSubview(toolbar)
            
            // Set the toolbar tint color to a lighter version of the button color
            let lighterTintColor = buttonTitleColor.withAlphaComponent(0.2)
            toolbar.tintColor = lighterTintColor
        }
        return viewController
    }
    
    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {
        // No need to update the view controller
    }
    
    func makeCoordinator() -> Coordinator {
        return Coordinator(self)
    }
    
    class Coordinator: NSObject {
        var parent: WebViewContainer
        
        init(_ parent: WebViewContainer) {
            self.parent = parent
        }

        @objc func dismiss() {
            parent.webView.stopLoading()
            parent.webView.configuration.userContentController.removeScriptMessageHandler(forName: "callbackHandler")
            UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
            UIApplication.shared.windows.first?.rootViewController?.dismiss(animated: true, completion: nil)
        }
    }
}


func generateCardUpdatrURL(topSites: String, merchantSiteTags: String, buttonColor: String, showCloseButton: Bool) -> String {
    var closeButtonHeight = "40px"
    
    let jsonString = """
        {
            "config": {
                "app_container_id": "cardupdatr-frame",
                "hostname": "https://barclays.customer-dev.cardupdatr.app/",
                "top_sites": ["\(topSites)"],
                "merchant_site_tags": ["\(merchantSiteTags)"]
            },
            "style_template": {
                "button_color": "\(buttonColor)"
            }
        }
    """
    if showCloseButton {
            closeButtonHeight = "42px"
        } else {
            closeButtonHeight = "0px"
    }

    let startingHTML = """
        <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
                <script src="https://barclays.customer-dev.cardupdatr.app/cardupdatr-client.js"></script>
            </head>
            <body>
                <!-- Empty div to initialize the iFrame which loads CardUpdatr. -->
                <div class="cardupdatr-frame" id="cardupdatr-frame" style="padding-top: \(closeButtonHeight);"></div>
                <script>
                    window.initCardupdatr(settings = \(jsonString));
                </script>
            </body>
        </html>
    """
    
    return startingHTML
}

extension UIColor {
    convenience init(hex: String) {
        var hexString = hex.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()

        if hexString.hasPrefix("#") {
            hexString.remove(at: hexString.startIndex)
        }

        var rgbValue: UInt64 = 0
        Scanner(string: hexString).scanHexInt64(&rgbValue)

        let red = CGFloat((rgbValue & 0xFF0000) >> 16) / 255.0
        let green = CGFloat((rgbValue & 0x00FF00) >> 8) / 255.0
        let blue = CGFloat(rgbValue & 0x0000FF) / 255.0

        self.init(red: red, green: green, blue: blue, alpha: 1.0)
    }
}


struct RadioButtonGroup<Content: View>: View {
    @Binding var selectedIndex: Int
    let content: Content
    
    init(selectedIndex: Binding<Int>, @ViewBuilder content: () -> Content) {
        self._selectedIndex = selectedIndex
        self.content = content()
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            content
        }
    }
}

struct RadioButtonView: View {
    var text: String
    
    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            Image(systemName: "circle")
                .foregroundColor(.blue)
                .imageScale(.large)
                .onTapGesture {
                    print("\(text) selected")
                }
            Text(text)
                .fontWeight(.medium)
            Spacer()
        }
    }
}
