import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;

public class DownloadCSV {

    public static void main(String[] args) throws Exception {

        String url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS9X5pOXAZJqBgcOi3MHxst_utVGGhdsHlnFvxuAPG1Rux0z_tn87sMWg9PtXIsLHGPJWmtervRoP8c/pub?gid=1311584736&single=true&output=csv";

        HttpClient client = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.ALWAYS)
                .build();

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .GET()
                .build();

        HttpResponse<byte[]> response =
                client.send(request, HttpResponse.BodyHandlers.ofByteArray());

        if (response.statusCode() == 200) {
            Files.write(Path.of("data.csv"), response.body());
            System.out.println("Download successful.");
        } else {
            System.out.println("Failed with HTTP status: " + response.statusCode());
        }
    }
}